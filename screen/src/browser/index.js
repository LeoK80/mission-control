import {launch} from 'chrome-launcher';
import ChromeRemote from 'chrome-remote-interface';

let loadedURLs = [];
let chromeInstance = undefined;
const CYCLE_TIME_SECONDS = 20;
const RELOAD_TIME_SECONDS = 86400;
let TAB_CYCLE = true;
let KIOSK = true;
let currentTabIndex = 0;

const getCycleState = () => {
  return {
    timeSeconds: CYCLE_TIME_SECONDS,
    reloadSeconds: RELOAD_TIME_SECONDS,
    currentTab: currentTabIndex,
    enabled: TAB_CYCLE
  }
};

const getURLs = () => loadedURLs;

const setURLs = (urls) => {
  loadedURLs = urls;
  if (!chromeInstance)
    launchChrome();

  openTabs().then(openTabList => {
    loadTabs(loadedURLs).catch((error) => {
      console.error(error);
    }).then(() => {
      Promise.all(openTabList.map(id => closeTab(id))).catch((error) => {
        console.log(`Error Closing ${id}`);
      }).then(() => {
        _activateTab(0);
      });
    });
  });
};

const startCycle = () => {
  TAB_CYCLE = true;
  tabCycle();
};

const stopCycle = () => {
  TAB_CYCLE=false;
};

const tabCycle = () => {
  setTimeout(() => {
    currentTabIndex++;
    _activateTab(currentTabIndex);
    if(TAB_CYCLE){
      tabCycle();
    }
  }, CYCLE_TIME_SECONDS*1000)
};

const _activateTab = (index) => {
  const { port } = chromeInstance;
  openTabs().then(openTabList => {
    currentTabIndex = index % openTabList.length;
    const id = openTabList[currentTabIndex];
    ChromeRemote.Activate({ port, id })
  });
};


const openTabs = () => {
  const { port } = chromeInstance;
  return ChromeRemote.List({ port })
    .then((targets) => {
      return targets.filter(target => target.type == 'page').map((target) => target.id);
    });
};

const closeTab = (id) => {
  const { port } = chromeInstance;
  return ChromeRemote.Close({ port, id });
};

const loadTabs = (urls) => {
  const { port } = chromeInstance;
  const urlLoad = urls.map((url) => ChromeRemote.New({ port, url }));
  return Promise.all(urlLoad);
};

const setKiosk = (kiosk_flag) => {
  KIOSK = kiosk_flag;
};

const runScript = async (expression) => {
  const { port } = chromeInstance;
  const protocol = await ChromeRemote({
    port
  });

  const {
    Runtime
  } = protocol;

  await Runtime.enable();

  await Runtime.evaluate({
    expression
  });

};

const scheduledReload = () => {
  setTimeout( () => {
    _reload();
    scheduledReload();
  }, RELOAD_TIME_SECONDS*1000);
};

const _reload = () => {
  console.log("Reloading All!");
  const currentURLs = getURLs();
  setURLs(currentURLs);
};

const launchChrome = () => {
  const chromeFlags = ['--no-default-browser-check', '--no-sandbox'];
  if ( KIOSK ) {
    chromeFlags.push('--kiosk');
  }
  chromeInstance = launch({
    chromeFlags
  }).then(chrome => {
    chromeInstance = chrome;
    setURLs(loadedURLs)
    console.log(`Chrome debugging port running on ${chrome.port}`);
  });
  scheduledReload();
};

export default { setURLs, getURLs, startCycle, stopCycle, getCycleState, setKiosk, runScript };
