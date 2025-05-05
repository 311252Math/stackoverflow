// ==UserScript==
// @name          EasyFanatic
// @version       1.0.0
// @description   A script which automatically visits the flag-summary pages of all your accounts every day, giving you the Enthusiast and Fanatic badges on all sites.
// @author        Starship
// @attribution   Floern (https://github.com/Floern)
// @include       *://stackexchange.com/users/*/*
// @match         *://*.stackexchange.com/users/flag-summary/*
// @match         *://*.stackoverflow.com/users/flag-summary/*
// @match         *://*.superuser.com/users/flag-summary/*
// @match         *://*.serverfault.com/users/flag-summary/*
// @match         *://*.askubuntu.com/users/flag-summary/*
// @match         *://*.stackapps.com/users/flag-summary/*
// @match         *://*.mathoverflow.net/users/flag-summary/*
// @connect       stackexchange.com
// @connect       stackoverflow.com
// @connect       superuser.com
// @connect       serverfault.com
// @connect       askubuntu.com
// @connect       stackapps.com
// @connect       mathoverflow.net
// @require       https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @grant         GM.xmlHttpRequest
// @grant         GM_xmlhttpRequest
// @grant         GM.addStyle
// @grant         GM_addStyle
// @run-at        document-end
// @updateURL     https://gist.github.com/311252Math/3fee32a57f3ddcafbd261f5cfd980033/raw/easyfanatic.js
// @downloadURL   https://gist.github.com/311252Math/3fee32a57f3ddcafbd261f5cfd980033/raw/easyfanatic.js
// ==/UserScript==

let flagSummaryTable, flagSummaryTableBody, errorView;
let rateLimited = false;
let starturl = 'https://stackexchange.com/users/current?tab=easyfanatic';
let day = 0;
setInterval(startprogram, 43200000);
function startprogram() {
    day += 0.5;
    window.open(starturl, '_blank').focus();
}
// init
(function () {
    if (window.location.href.match(/\/users\/flag-summary\/\d+/i)) {
        return;
    }
    if (!window.location.href.match(/:\/\/stackexchange\.com\/users\/\d+/i)) {
        return;
    }
    let navigation = document.querySelector('#content .contentWrapper .subheader');
    if (!navigation) {
        return;
    }
    let tabbar = navigation.querySelector('.tabs');

    // verify that we are in the profile of the logged in user
    let tabs = tabbar.getElementsByTagName('a');
    let loggedIn = false;
    for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].textContent.trim().toLowerCase() == 'inbox') {
            loggedIn = true;
            break;
        }
    }
    if (!loggedIn) {
        return;
    }

    // add navigation tab for easyfanatic
    let Tab = document.createElement('a');
    Tab.setAttribute('href', '?tab=easyfanatic');
    Tab.textContent = 'EasyFanatic';
    tabs[4].parentNode.insertBefore(Tab, tabs[4]);
    if (!window.location.href.match(/:\/\/stackexchange\.com\/users\/\d+\/.+?\?tab=easyfanatic/i)) {
        return;
    }

    // unselect default tab
    let selectedTab = navigation.querySelector('.youarehere');
    selectedTab.className = '';

    // set selected tab to easyfanatic
    Tab.className = 'youarehere';

    // remove default content
    while (navigation.nextSibling) {
        navigation.parentNode.removeChild(navigation.nextSibling);
    }
    document.querySelector('title').textContent = 'Easy Fanatic';
    let container = document.createElement('div');
    navigation.parentNode.appendChild(container);

    // setup summary table
    flagSummaryTable = document.createElement('table');
    container.appendChild(flagSummaryTable);
    flagSummaryTableBody = flagSummaryTable.getElementsByTagName('tbody')[0];

    // prepare error view
    errorView = document.createElement('div');
    container.appendChild(errorView);

    // create loading view
    let loadingView = document.createElement('div');
    loadingView.id = 'flag-summary-loading';
    loadingView.style.textAlign = 'left';
    loadingView.innerHTML = '<span id="flag-summary-loading-progress" style="color:	#000000;font-size:50px;"></span>';
    container.appendChild(loadingView);
    rateLimited = false;

    // load data
    loadAccountList();
})();

/**
 * Load the network account list.
 */
function loadAccountList() {
    let accountListUrl = 'https://stackexchange.com/users/current?tab=accounts';
    GM.xmlHttpRequest({
        method: 'GET',
        url: accountListUrl,
        onload: function(response) {
            parseNetworkAccounts(response.response);
        }
    });
}

/**
 * Parse the network account list.
 */
function parseNetworkAccounts(html) {
    let parser = new DOMParser();
    let pageNode = parser.parseFromString(html, 'text/html');
    let accounts = [];

    // iterate all accounts
    let accountNodes = pageNode.querySelectorAll('.contentWrapper .account-container');
    for (let i = 0; i < accountNodes.length; ++i) {
        let accountNode = accountNodes[i];
        let siteLinkNode = accountNode.querySelector('.account-site a');
        if (!siteLinkNode) {
            continue;
        }
        if (siteLinkNode.href.indexOf('area51.stackexchange.com/') != -1) {
            // use area51.meta.SE instead
            siteLinkNode.href = siteLinkNode.href.replace('//area51.st', '//area51.meta.st');
        }
        let siteName = siteLinkNode.textContent.trim();
        let siteFlagSummaryUrl = siteLinkNode.href.replace(/users\/(\d+)\/.*$/i, 'users/flag-summary/$1');
        accounts.push({siteName: siteName, flagSummaryUrl: siteFlagSummaryUrl});

        // add meta site
        if (!/(meta\.stackexchange|area51\.stackexchange|stackapps)\.com\//.test(siteFlagSummaryUrl)) {
            let metaSiteFlagSummaryUrl;
            if (/\.stackexchange\.com\//.test(siteFlagSummaryUrl)) // SE 2.0 sites
                metaSiteFlagSummaryUrl = siteFlagSummaryUrl.replace('.stackexchange.com', '.meta.stackexchange.com');
            else if (/\/\/[a-z]{2}\.stackoverflow\.com\//.test(siteFlagSummaryUrl)) // localized SO sites
                metaSiteFlagSummaryUrl = siteFlagSummaryUrl.replace('.stackoverflow.com', '.meta.stackoverflow.com');
            else // SE 1.0 sites
                metaSiteFlagSummaryUrl = siteFlagSummaryUrl.replace('//', '//meta.');
            accounts.push({siteName: siteName + " Meta", flagSummaryUrl: metaSiteFlagSummaryUrl});
        }
    }

    // load the sites
    let i = -1;
    let loaded = 0;
    function loadNextSite() {
        i++;
        if (i >= accounts.length) {
            // end of list
            return;
        }
        let account = accounts[i];
        let delay = (i < 25 ? 100 : (i < 160 ? 450 : 1111));
        setTimeout(function() {
            if (rateLimited) {
                return;
            }
            loadSiteFlagSummary(account.siteName, account.flagSummaryUrl, function() {
                loaded++;
                let progressText = document.getElementById('flag-summary-loading-progress');
                if (rateLimited) {
                    progressText.textContent = 'aborted (rate limited)';
                }
                else {
                    progressText.textContent = 'Visiting all sites. ' + loaded + ' / ' + accounts.length + ' completed.';
                }
                if (loaded >= accounts.length) {
                    // end of list
                    document.getElementById('flag-summary-loading').style.visibility = 'hidden';
                    progressText.textContent = 'All sites where you have a profile have been visited. You can close this page now.';
                    window.close();
                }
            });
            loadNextSite();
        }, delay);
    }
    loadNextSite();
}

/**
 * Load the flag summary of the specified site.
 */
function loadSiteFlagSummary(siteName, siteFlagSummaryUrl, finishedCallback) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: siteFlagSummaryUrl,
        onload: function(response) {
            if (response.status < 400) {
                parseSiteFlagSummary(siteName, siteFlagSummaryUrl, response.response);
            }
            else {
                if (response.status == 429) {
                    rateLimited = true;
                }
            }
            finishedCallback();
        }
    });
}

/**
 * Record that the flag summary has been visited
 */
function parseSiteFlagSummary(siteName, siteFlagSummaryUrl, html) {
    let siteFlagSummaryTr = document.createElement('tr');
}
