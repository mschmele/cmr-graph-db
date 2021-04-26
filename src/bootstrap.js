const { process, driver } = require('gremlin');
const { fetchPageFromCMR, clearScrollSession, pageSize } = require('./cmr')

const initializeGremlinConnection = () => {
    const traversal = process.AnonymousTraversalSource.traversal;
    const DriverRemoteConnection = driver.DriverRemoteConnection;

    return traversal().withRemote(new DriverRemoteConnection('ws://localhost:8182/gremlin'));
}

const indexRelatedUrl = (relatedUrl, gremlin, dataset) => {
    const { Type, SubType, URL, Description } = relatedUrl
    if (!!Type
        || !!SubType
        || Type !== "VIEW RELATED INFORMATION"
        || SubType !== "GENERAL DOCUMENTATION") {
        // Nothing to do here
        return;
    }

    documentationVertexExists = g.V().hasLabel("documentation").has("name", urlString).hasNext();
    let docVertex;

    if (documentationVertexExists) {
        docVertex = gremlin.addV("documentation").property("name", URL).property("title", Description).next()
    } else {
        docVertex = gremlin.V().hasLabel("documentation").has("name", URL).next();
    }

    gremlin.addE("documents").from(g.V(docVertex.id())).to(g.V(dataset.id())).next();
}

const indexCmrCollection = async (collection, gremlin) => {
    const { meta, umm } = collection;
    const conceptId = meta['concept-id'];
    const { EntryTitle, DOI, RelatedUrls } = umm;
    const hasDOI = !!DOI.DOI;
    let doiUrl = "Not supplied";
    let datasetName = `https://cmr.earthdata.nasa.gov/concepts/${conceptId}.html`;

    if (hasDOI) {
        const doiAddress = DOI.DOI.split(':').pop();
        doiUrl = `http://doi.org/${doiAddress}`;
        datasetName = doiAddress;
    }

    const exists = await gremlin.V().hasLabel("dataset").has("concept-id", conceptId).hasNext();
    console.log(`DATASET EXISTS: ${exists}`);
    let dataset = null;
    if (!exists) {
        dataset = await gremlin
        .addV("dataset")
        .property("name", datasetName)
        .property("title", EntryTitle)
        .property("concept-id", conceptId)
        .property("doi", DOI.DOI || "Not supplied")
        .next();
    }
    else {
        dataset = await gremlin.V().hasLabel("dataset").has("name", datasetName).next();                              
    }
    
    if (RelatedUrls && RelatedUrls.length >= 1) {
        RelatedUrls.map(relatedUrl => {
            indexRelatedUrl(relatedUrl, gremlin, dataset);
        })
    }
    
    return 200;
}

const scrollCmrCollections = async () => {
    let { scrollId, response } = await fetchPageFromCMR();
    let partitionedSearchResults = [];
    let continueScroll = true;

    partitionedSearchResults.push(response);
    while (continueScroll){
        console.log(`Results count: ${response.length}`);
        let scrolledResults = (await fetchPageFromCMR(scrollId)).response;
        partitionedSearchResults.push(scrolledResults);

        if (scrolledResults.length < pageSize) {
            continueScroll = false;
        }
    }

    console.log(`Got scroll-id: [${scrollId}]. Clearing session...`);
    clearScrollSession(scrollId);

    console.log(`Partitions: ${partitionedSearchResults.length}`);
    return partitionedSearchResults;
}

exports.bootstrapGremilinServer = async () => {
    const partitionedSearchResults = await scrollCmrCollections();
    const gremlin = initializeGremlinConnection();
    let indexingStatuses = [];

    partitionedSearchResults.forEach(partition => {
        const indexingStatus = partition.map(result => indexCmrCollection(result, gremlin));
        indexingStatuses.push(indexingStatus);
    })
    

    return indexingStatuses;
}