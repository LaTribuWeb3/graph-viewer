import './App.css';

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { useEffect, useState } from 'react';

import { Line } from 'react-chartjs-2';
import axios from 'axios';
import { largeNumberFormatter } from './components/utils';
import { parse } from 'papaparse';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);


async function getParameters(entity, repo, dir) {

  // get files
  const url = `https://api.github.com/repos/${entity}/${repo}/git/trees/main`;
  const dirTreeResponse = await axios.get(url);
  let dirSHA = dirTreeResponse.data.sha;

  if (dir) {
    dirSHA = await findDirSHAForSubDir(dir, dirTreeResponse, repo, dirSHA, entity);
  }

  const dirUrl = `https://api.github.com/repos/${entity}/${repo}/git/trees/${dirSHA}`;
  const filesResponse = await axios.get(dirUrl);
  const allCSVsNames = filesResponse.data.tree.filter(_ => _.path.endsWith('.csv')).map(_ => _.path);
  let tooltip = undefined;
  try {
    const tooltipReq = await axios.get(`https://raw.githubusercontent.com/${entity}/${repo}/main/${dir}/tooltip.json`);
    tooltip = tooltipReq.data;
  }
  catch (error) {
    console.log('no tooltip data in specified directory')
  }

  // extract parameter names from the first image 
  // bib-0.1+brh-0.001+vfs-125+clf-0.1.jpg
  const parametersString = allCSVsNames[0].replace('.csv', '');
  // bib-0.1+brh-0.001+vfs-125+clf-0.1
  const parameters = parametersString.split('+')
  // bib-0.1 brh-0.001 vfs-125 clf-0.1
  const extractedParameters = {};
  for (const prm of parameters) {
    const paramName = prm.split('-')[0];
    const paramNameBeautified = paramName.replace(/([A-Z])/g, ' $1').trim();



    extractedParameters[paramName] = {
      nameBeautified: paramNameBeautified
    };
    if (tooltip && tooltip[paramName]) {
      extractedParameters[paramName].tooltipText = tooltip[paramName];
    }
    else {
      extractedParameters[paramName].tooltipText = undefined;
    }
  }


  const paramSets = {};
  for (const CSVFileName of allCSVsNames) {
    // bib-0.1+brh-0.001+vfs-125+clf-0.1.jpg
    const CSVParams = CSVFileName.replace('.csv', '').split('+');

    for (const prm of CSVParams) {
      const paramName = prm.split('-')[0];
      const paramValue = prm.split('-')[1];

      if (!paramSets[paramName]) {
        paramSets[paramName] = new Set();
      }
      paramSets[paramName].add(paramValue)
    }
  }

  for (const paramName of Object.keys(extractedParameters)) {
    extractedParameters[paramName].range = Array.from(paramSets[paramName]).sort((a, b) => Number(a) - Number(b))
  }
  return extractedParameters;
}

async function findDirSHAForSubDir(dir, dirTreeResponse, repo, dirSHA, entity) {
  let builtPath = '';
  const subDirs = dir.split('/');
  let nextDir = subDirs.shift();

  // find the dir in the dirTree
  let nextDirTree = dirTreeResponse.data.tree.find(_ => _.path === nextDir);
  if (!nextDirTree) {
    throw new Error(`Could not find directory ${builtPath}/${nextDirTree} in ${repo}`);
  }

  dirSHA = nextDirTree.sha;
  builtPath += `${nextDir}/`;

  while (subDirs.length > 0) {
    const nextUrl = `https://api.github.com/repos/${entity}/${repo}/git/trees/${dirSHA}`;
    const nextDirThreeResponse = await axios.get(nextUrl);
    nextDir = subDirs.shift();

    nextDirTree = null;
    for (const dirTree of nextDirThreeResponse.data.tree) {
      if (dirTree.path === nextDir) {
        nextDirTree = dirTree
      }
    }
    if (!nextDirTree) {
      throw new Error(`Could not find directory ${builtPath}${nextDirTree} in ${repo}`);
    }

    dirSHA = nextDirTree.sha;
    builtPath += `${nextDir}/`;
  }

  return dirSHA;
}



function Row(props) {
  const param = props.param;
  const tooltip = props.parameters[param].tooltipText
  const value = props.currentData[param];
  const upReached = value === props.parameters[param].range.at(-1) ? true : false;
  const downReached = value === props.parameters[param].range[0] ? true : false;

  return <div className='Row-container'>
    <div className='Row'>
      <p className='Row-text' key={param} title={tooltip}>{props.parameters[param].nameBeautified}</p>
      <button className='Row-button' onClick={() => props.handleChange(param, value, 'down')} disabled={downReached}>{'<'}</button>
      <p className='Row-value'>{value}</p>
      <button className='Row-button' onClick={() => props.handleChange(param, value, 'up')} disabled={upReached}>{'>'}</button>
    </div>
  </div>
}

function App() {
  const [parameters, setParameters] = useState([]);
  const [currentData, setCurrentData] = useState({});
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState(undefined);
  const [lineNames, setLineNames] = useState(undefined);
  const [visibilityToggles, setVisibilityToggles] = useState({});
  const [loaded, setLoaded] = useState(false);
  // get all images
  ///get parameters for call
  const urlParams = new URLSearchParams(window.location.search);
  const entity = urlParams.get('entity');
  const repo = urlParams.get('repo');
  const dir = urlParams.get('dir') == null ? '' : urlParams.get('dir');

  //// recursive call to get all images
  useEffect(() => {
    async function getData() {

      if (entity == null || repo == null) {
        console.log('entity or repo is null');
        return;
      }
      const params = await getParameters(entity, repo, dir);
      setParameters(params);
      const baseCurrentData = {}
      for (const [paramName, paramValue] of Object.entries(params)) {
        baseCurrentData[paramName] = paramValue.range[0];
      }
      setCurrentData(baseCurrentData);
      setLoading(false);
    }
    getData();
  }, [dir, entity, repo]);

  useEffect(() => {
    function getCSVUrlFromData(entity, repo, dir, data) {
      setLoaded(false);
      let CSVName = '';
      for (const [paramName, paramValue] of Object.entries(data)) {
        CSVName += CSVName ? `+${paramName}-${paramValue}` : `${paramName}-${paramValue}`;
      }

      CSVName += '.csv'
      if (dir) {
        return `https://raw.githubusercontent.com/${entity}/${repo}/main/${dir}/${CSVName}`;
      } else {
        return `https://raw.githubusercontent.com/${entity}/${repo}/main/${CSVName}`;
      }
    }

    function CSVDataFormatting(CSVData) {
      setLoaded(false);
      const length = CSVData.data.length - 1;
      
      const headers = CSVData.data[0];
      const linesNames = headers.filter(_ => { if (_ !== 'timestamp' && _ !== "") return _ });
      linesNames.sort();
      const graphDatasets = {};
      const graphData = {};
      const graphDatasetsArray = [];
      for(let i = 0; i < headers.length; i++){
        graphDatasets[headers[i]] = [];
      }
      for(let i = 1; i < length; i++){
        for (let j = 0; j < CSVData.data[i].length; j++) {
          graphDatasets[headers[j]].push(Number(CSVData.data[i][j]));
        };
      }
      for(const [key, value] of Object.entries(graphDatasets)){
        const toPush = {
          label: key,
          data: value
        }
        graphDatasetsArray.push(toPush);
      }
      graphDatasetsArray.shift();
      graphData['labels'] = graphDatasetsArray[0].data;
      graphDatasetsArray.shift();
      graphData['datasets'] = graphDatasetsArray;
      const visibilityToggles = {};
      for (let i = 0; i < linesNames.length; i++) {
        visibilityToggles[linesNames[i]] = false;
      }
      setLineNames(linesNames);
      setGraphData(graphData);
      setVisibilityToggles(visibilityToggles);
      setLoaded(true);
    }
    const CSVURL = getCSVUrlFromData(entity, repo, dir, currentData);
    parse(CSVURL, { download: true, complete: CSVDataFormatting });
  }, [currentData]);

  //buttons
  function changeState(param, value, direction) {
    const stateReplacement = { ...currentData };
    const index = parameters[param].range.indexOf(value);
    if (direction === 'up') {
      stateReplacement[param] = parameters[param].range[index + 1];
      if (stateReplacement[param]) {
        setCurrentData(stateReplacement);
      };
    }
    else {
      stateReplacement[param] = parameters[param].range[index - 1];
      if (stateReplacement[param]) {
        setCurrentData(stateReplacement);
      };
    }
  }
  function toggleLine(line) {
    setVisibilityToggles({ ...visibilityToggles, [line.dataKey]: !visibilityToggles[line.dataKey] });
  }

  function formatLegend(legend) {
    const legendName = legend.split('_');
    return legendName.reduce((acc, word) => acc ? acc + ` ${word}` : acc + word);
  }
  function xAxisFormatter(timestamp) {
    const date = new Date(timestamp / 1e3);
    return date.toLocaleDateString();
  }

    function tooltipFormatter(value, name){
      return [largeNumberFormatter(value), formatLegend(name)];
    }
    function tooltipLabelFormatter(timestamp){
      const date = new Date(timestamp / 1e3);
      return date.toLocaleString();
    }

    function tryMe(){
      const url = window.location + "?entity=0xvorian&repo=csv-reader-testing&dir=test"
      window.location.href= url;
    }

    return (
      <div className="App">
        <div className='Header'><picture><source srcSet='./white-wordmark.png' media='(prefers-color-scheme: dark)'/><img src='./black-wordmark.png' alt='Risk DAO logo'/></picture></div>
        {(entity == null || repo == null) ? <div className='Card'> Please enter entity and repo <br/> or <br/> <button className='TryMe' onClick={tryMe}>Try me</button> </div> : loading ? <div className='Card'> Loading </div> :
          <div className='Card'>
            <div className='App-graph'>
              {loading ? 'loading data' : graphData && loaded ?
                <Line data={graphData}/>
                : 'Failed to load graph data.'}
            </div>
            <div className='App-controls'>{Object.keys(currentData).map((_, i) =>
              <Row param={_} key={i} parameters={parameters} currentData={currentData} handleChange={changeState} />
            )}</div>
          </div>
        }
      </div>

    );
  }

  export default App;
