"use strict";
// ==UserScript==
// @name         Omnivore in Bing
// @version      0.1
// @description  Injects Omnivore notes into Bing search results
// @author       Benature
// @namespace    https://github.com/Benature/omnivore-beside-seach-engine
// @downloadURL  https://github.com/Benature/omnivore-beside-seach-engine/raw/master/obsidian-omnisearch-bing.user.js
// @updateURL    https://github.com/Benature/omnivore-beside-seach-engine/raw/master/obsidian-omnisearch-bing.user.js
// @match        *://*bing.com/*
// @match        https://bing.com/*
// @match        https://www.bing.com/*
// @icon         https://docs.omnivore.app/favicon.ico
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @require      https://raw.githubusercontent.com/sizzlemctwizzle/GM_config/master/gm_config.js
// @require      https://gist.githubusercontent.com/scambier/109932d45b7592d3decf24194008be4d/raw/9c97aa67ff9c5d56be34a55ad6c18a314e5eb548/waitForKeyElements.js
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==
(function () {
    "use strict";
    // Bing's right "sidebar" selector for additional content
    const sidebarSelector = "#b_context";
    // The results div
    const resultsDivId = "OmnivoreResultsBing";
    // The "loading"/"no results" label
    const loadingSpanId = "OmnivoreLoadingBing";
    // Configure GM_config
    // The `new GM_config()` syntax is not recognized by the TS compiler
    // @ts-ignore
    const gmc = new GM_config({
        id: "OmnivoreBing",
        title: "Omnivore in Bing - Configuration",
        fields: {
            apiKey: {
                label: "API key",
                type: "text",
                default: "xxxx",
            },
            urlAPI: {
                label: "API url",
                type: "text",
                default: "https://api-prod.omnivore.app",
            },
            urlWeb: {
                label: "Omnivore url",
                type: "text",
                default: "https://omnivore.app",
            },
            username: {
                label: "username",
                type: "text",
                default: "demo_user",
            },
            nbResults: {
                label: "Number of results to display",
                type: "int",
                default: 3,
            },
        },
        events: {
            save: () => location.reload(),
            init: () => { },
        },
    });
    // GM_registerMenuCommand("Open Omnivore Configuration", GM_config.open);

    // Promise resolves when initialization completes
    const onInit = (config) => new Promise((resolve) => {
        let isInit = () => setTimeout(() => (config.isInit ? resolve() : isInit()), 0);
        isInit();
    });

    function formatUrl(url) {
        if (url.endsWith("/")) {
            url = url.slice(0, url.length - 1);
        }
        return url;
    }

    function searchOmnivore() {
        const nbResults = gmc.get("nbResults");
        const url_api = formatUrl(gmc.get("urlAPI"));
        const url_web = formatUrl(gmc.get("urlWeb"));
        const username = gmc.get("username");

        const params = new URLSearchParams(window.location.search);
        const query = params.get("q");
        if (!query)
            return;
        injectLoadingLabel();
        GM.xmlHttpRequest({
            method: "POST",
            url: `${url_api}/api/graphql`,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': gmc.get("apiKey"),
            },
            data: JSON.stringify({
                "query": "\n  query Search(\n    $after: String\n    $first: Int\n    $query: String\n    $includeContent: Boolean\n  ) {\n    search(\n      first: $first\n      after: $after\n      query: $query\n      includeContent: $includeContent\n    ) {\n      ... on SearchSuccess {\n        edges {\n          cursor\n          node {\n            id\n            title\n            slug\n            url\n            folder\n            pageType\n            contentReader\n            createdAt\n            readingProgressPercent\n            readingProgressTopPercent\n            readingProgressAnchorIndex\n            author\n            image\n            description\n            publishedAt\n            ownedByViewer\n            originalArticleUrl\n            uploadFileId\n            labels {\n              id\n              name\n              color\n            }\n            pageId\n            shortId\n            quote\n            annotation\n            state\n            siteName\n            siteIcon\n            subscription\n            readAt\n            savedAt\n            wordsCount\n            highlightsCount\n          }\n        }\n        pageInfo {\n          hasNextPage\n          hasPreviousPage\n          startCursor\n          endCursor\n          totalCount @include(if: false)\n        }\n      }\n      ... on SearchError {\n        errorCodes\n      }\n    }\n  }\n",
                "variables": {
                    "after": "0",
                    "first": 10,
                    "query": query,
                    "includeContent": false
                }
            }),
            onload: function (response) {
                const data = JSON.parse(response.responseText);
                const edges = data.data.search.edges
                removeLoadingLabel(edges.length > 0);
                edges.splice(nbResults);
                const resultsDiv = $(`#${resultsDivId}`);
                resultsDiv.empty(); // Clear previous results
                edges.forEach((item) => {

                    const node = item.node;
                    // console.log(node);
                    const description = node.description.slice(0, 140).replace(/<br\s*\/?>/gi, " ");
                    const resultHTML = `
                        <div class="b_algo" data-omnisearch-result style="padding: 10px; border-bottom: 1px solid #ccc;">
                            <h2 class="b_attribution" style="margin-bottom: 5px;">
                                <a href="${node.url}" target="_blank"><span style="vertical-align: middle; margin-right: 0.5em;"></span>
                                  ${node.title}</a>
                              <a href="${url_web}/${username}/${node.slug}"> 🔗 </a>
                            </h2>
                            <p>${description}...</p>
                        </div>
                    `;
                    resultsDiv.append(resultHTML);
                });
            },
            onerror: function () {
                const span = $(`#${loadingSpanId}`);
                if (span.length) {
                    span.html(`Error: Failed to request Omnivore API.
                      <br /><a href="${gmc.get("urlWeb")}">Open Omnivore</a>.`);
                }
            }
        });
    }

    function injectLoadingLabel() {
        if (!$(`#${loadingSpanId}`).length) {
            $(sidebarSelector).prepend(`<span id="${loadingSpanId}">Loading...</span>`);
        }
    }

    function removeLoadingLabel(foundResults = true) {
        if (foundResults) {
            $(`#${loadingSpanId}`).remove();
        }
        else {
            $(`#${loadingSpanId}`).text("No results found");
        }
    }

    function injectResultsContainer() {
        if (!$(`#${resultsDivId}`).length) {
            $(sidebarSelector).prepend(`<div id="${resultsDivId}" style="margin-top: 20px; position: relative;"></div>`);
        }
    }

    function showSettingsDialog() {
        gmc.open();
    }

    console.log("Loading Omnivore injector");
    let init = onInit(gmc);
    init.then(() => {
        gmc.init();
        injectResultsContainer();
        searchOmnivore(); // Make an initial call, just to avoid an improbable race condition
        console.log("Loaded Omnivore injector");
        // Add a button to show settings dialog
        const settingsButton = $("<button>Settings</button>").css({
            marginRight: "10px",
        }).click(showSettingsDialog);
        const headerContainer = $("<div></div>").css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
        });
        const resultsHeader = $(`<h2><img src="https://docs.omnivore.app/favicon.ico" alt="Icon" style="width: 15px; height: 15px; margin-right: 10px;">Omnivore Search Results</h2>`);
        headerContainer.append(resultsHeader, settingsButton); // Append both the header and the button to the container
        $(sidebarSelector).prepend(headerContainer); // Prepend the container instead of the header
    });
})();
