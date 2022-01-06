import * as config from './config.json';
import { readFile, writeFile, copyFile, mkdir } from 'fs/promises';
import { buildTypeDef } from './typedef';
import { buildResolvers } from './resolvers';

async function makeDirs(path: string) {
    await mkdir(path, { recursive: true });
    await mkdir(path + '/src/idls', { recursive: true });
}

async function copyFiles(path: string) {
    await copyFile('./src/template/package-template.json', path + '/package.json');
    let data = await readFile(path + `/package.json`, 'utf8');
    let result = data.replace(/__YOURANCHORPROVIDERURL__/g, config.anchorProviderURL);
    await writeFile(path + `/package.json`, result);
    await copyFile(config.idlPath, path + config.idlPath.substring(1));
    await copyFile('./src/template/tsconfig-template.json', path + '/tsconfig.json');
    await copyFile('./src/config.json', path + '/src/config.json');
}

async function main() {
    //** Edit this to change your server directory */
    const subDir = config.prdMode ? './src/server' : './src/program_' + config.projectName;
    const pwd = process.cwd();
    let idlConfig = await import('../' + config.idlPath);
    const indexOutputFile = subDir + '/src/index.ts';
    const typeDefOutputFile = subDir + '/src/root.ts';
    await makeDirs(subDir);
    await copyFiles(subDir);
    await buildTypeDef(idlConfig, config.typeDefTemplateFile, typeDefOutputFile);
    await buildResolvers(idlConfig, config.indexTemplateFile, indexOutputFile);
    console.log('Successfully generated the new graphql project');
}

main();
