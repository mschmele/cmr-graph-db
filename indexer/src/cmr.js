// import fetch from 'node-fetch';
const fetch = require('node-fetch');
const { getSecureParam } = require('./util');

/* CMR ENVIRONMENT VARIABLES */
// const cmrRootUrl = `http://${process.env.CMR_ROOT}`;
exports.pageSize = 2000;
const cmrRootUrl = "https://cmr.uat.earthdata.nasa.gov";
const cmrClearScrollUrl = `${cmrRootUrl}/search/clear-scroll`;
const cmrCollectionUrl = `${cmrRootUrl}/search/collections.umm_json?page_size=${this.pageSize}&scroll=true`;

/**
 * getEchoToken: Fetch token for CMR requests
 * @returns {String} ECHO Token for CMR requests
 * @throws {Error} If no token is found. CMR will not return anything
 * if no token is supplied.
 */
const getEchoToken = async () => {
  console.log(process.env.CMR_ENVIRONMENT);
  const response = getSecureParam(
    `/${process.env.CMR_ENVIRONMENT}/browse-scaler/CMR_ECHO_SYSTEM_TOKEN`
  );

  if (response === undefined) {
    throw new Error('ECHO Token not found. Please update config!');
  } else {
    console.log('Retrieved ECHO TOKEN');
  }

  return response;
};

/**
 * fetchPageFromCMR: Fetch a page of collections from CMR
 * search endpoint and initiate or continue scroll request
 * @param scrollId {String} An optional scroll-id given from the CMR
 * @returns [{JSON}] An array of UMM JSON collection results
 */
exports.fetchPageFromCMR = async scrollId => {
  const token = null;// getEchoToken();
  const requestHeaders = {};
  
  if (token) {
    requestHeaders['Echo-Token'] = token;
  }

  if (scrollId) {
    requestHeaders['CMR-Scroll-Id'] = scrollId;
  }
  
  let scrollSession;
  const response = await fetch(cmrCollectionUrl, {
    method: 'GET',
    headers: requestHeaders
  })
    .then(response => {
      scrollSession = response.headers.get("CMR-Scroll-Id");
      return response.json();
    })
    .then(json => {
      if (json.errors) {
        throw new Error(`The following errors ocurred: ${json.errors}`);
      } else {
        return json.items;
      }
    })
    .catch(error => {
      console.log(`Could not complete request due to error: ${error}`);
      return null;
    });

  return {
    "scrollId": scrollSession || scrollId,
    "response": response
  };
};

exports.clearScrollSession = async scrollId => {
  const response = await fetch(cmrClearScrollUrl, {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({'scroll_id': scrollId})
  }).then(response => response.status);

  console.log(`Cleared scroll session [${scrollId}]. Status code was: ${response}`);

  return response;
}