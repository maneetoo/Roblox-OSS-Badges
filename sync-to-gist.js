const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_ID = process.env.GIST_ID;
const BADGES_DIR = './Badges';

if (!GIST_TOKEN || !GIST_ID) {
  console.error('Missing GIST_TOKEN or GIST_ID environment variables');
  process.exit(1);
}

const octokit = new Octokit({ auth: GIST_TOKEN });

function collectSVGFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      collectSVGFiles(filePath, fileList);
    } else if (path.extname(file).toLowerCase() === '.svg') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function createGistFiles(svgPaths) {
  const files = {};
  
  svgPaths.forEach(svgPath => {
    const relativePath = path.relative(BADGES_DIR, svgPath);
    const gistFileName = relativePath.replace(/\//g, '-').replace(/\\/g, '-');
    const content = fs.readFileSync(svgPath, 'utf8');
    
    files[gistFileName] = {
      content: content
    };
  });
  
  return files;
}

async function syncToGist() {
  try {
    console.log('Collecting SVG files from Badges/...');
    const svgFiles = collectSVGFiles(BADGES_DIR);
    
    if (svgFiles.length === 0) {
      console.log('No SVG files found in Badges/');
      return;
    }
    
    const gistFiles = createGistFiles(svgFiles);
    const { data: currentGist } = await octokit.gists.get({
      gist_id: GIST_ID
    });
    
    const currentFiles = Object.keys(currentGist.files);
    const newFiles = Object.keys(gistFiles);
    
    currentFiles.forEach(fileName => {
      if (!newFiles.includes(fileName) && fileName.endsWith('.svg')) {
        gistFiles[fileName] = null;
      }
    });
    
    await octokit.gists.update({
      gist_id: GIST_ID,
      description: `Roblox OSS Badges (Auto-synced from github.com/maneetoo/Roblox-OSS-Badges) - ${new Date().toISOString()}`,
      files: gistFiles
    });
    
    console.log('Successfully synced badges to Gist!');
    
  } catch (error) {
    console.error('Error syncing to Gist:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

syncToGist();
