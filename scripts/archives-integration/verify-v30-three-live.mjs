import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const base = resolve('.private/archives-integration'), root = resolve(base, 'publication-package-20261004-v30');
const out = resolve(base, 'publication-v30-three-live-20261004-v1'); await mkdir(out);
const assemblyBytes = await readFile(resolve(root, 'assembly.json')), assembly = JSON.parse(assemblyBytes);
const origin = 'http://127.0.0.1:8822', first = 'twentyfirst-v30-three-files', after = 'twentysecond-v30-three-restart', records = {}, requests = [];
try {
  for (const [name, directory] of [['monbezon','publication-wip-local-20261004-v1'], ['p09','publication-p09-wip-local-20261004-v1'], ['e108','publication-e108-source-wip-local-20261004-v1']]) {
    const folder = resolve(base, directory), initial = await readFile(resolve(folder, first + '-initial-snapshot.json'));
    const stopped = await readFile(resolve(folder, first + '-stopped-snapshot.json')), restarted = await readFile(resolve(folder, after + '-initial-snapshot.json'));
    ensure(initial.equals(stopped) && stopped.equals(restarted), 'Three-store restart altered state: ' + name);
    ensure(JSON.parse(await readFile(resolve(folder, first + '-stopped.json'))).clean_shutdown === true, 'Unclean prior shutdown');
    if(name !== 'e108') ensure(initial.equals(await readFile(resolve(folder, 'twentieth-v28-source-eleven-stopped-snapshot.json'))), 'v28 incoming state altered');
    const data = JSON.parse(restarted);
    ensure(data.revisions.length === 1 && data.decisions.length === 0 && data.proposals.length === (name === 'e108' ? 0 : 1), 'Editorial counters changed');
    records[name] = { bytes: restarted.length, sha256: sha(restarted), revisions: data.revisions.length, proposals: data.proposals.length, decisions: data.decisions.length, restart_byte_exact: true };
  }
  const id = '81f2195b2dd92184859c2301a8da2f1126c3b7e25cdf8b1d1f6684029fa66a45';
  const routes = ['/archives/fichiers/','/archives/avancement/','/archives/fichiers/e108-vue-11/','/archives/fichiers/e108-vue-11/L14.png','/archives/fichiers/e108-vue-11/L17.png','/assets/archives-e108-full-reader.css','/assets/archives-e108-full-reader.js','/archives/fichiers/e108-vue-11/passage-en-cours/','/archives/textes/fichier/'+id+'/','/archives/textes/fichier/'+id+'/corrections/','/assets/e108-source-corrections.mjs','/assets/e108-source-selection.mjs','/assets/e108-source-corrections.css'];
  for (const route of routes) {
    const response = await fetch(origin+route), bytes = Buffer.from(await response.arrayBuffer()), pin = assembly.files['dist'+route+(route.endsWith('/')?'index.html':'')];
    ensure(response.status === 200 && pin && sha(bytes) === pin.sha256, 'Served selected bytes changed: '+route);
    const csp = response.headers.get('content-security-policy'); ensure(csp && !/unsafe-inline|unsafe-eval/u.test(csp), 'CSP missing/changed');
    if(/\.(?:mjs|js)$/u.test(route)) ensure(response.headers.get('content-type')?.includes('javascript'), 'Script MIME changed');
    requests.push({route,status:200,selected_bytes_exact:true});
  }
  for (const route of ['/archives/catalogue/','/archives/catalogue/?query=11.jpg','/archives/texte/?object_id=object:path-'+id]) {
    const response = await fetch(origin+route), html = await response.text(); ensure(response.status === 200, 'Dynamic GET failed');
    ensure(route.startsWith('/archives/texte/') ? html.includes('/corrections/') && html.includes('data-source-file-context="e108-folder"') : html.includes('/archives/fichiers/e108-vue-11/') && html.includes('/passage-en-cours/'), 'Projection missing');
    requests.push({route,status:200,new_projection_present:true});
  }
  for (const route of ['/api/archive/public/monbezon/health','/api/archive/public/p09/health','/api/archive/public/e108-source/health']) {
    const response=await fetch(origin+route), body=await response.json(); ensure(response.status===200 && body.reading_confirmed===false && body.owner_access_enabled===false, 'Profile health/authority changed');
    requests.push({route,status:200,owner_disabled:true});
  }
  const query='?object_id='+encodeURIComponent('object:path-'+id)+'&text_digital_object_id='+encodeURIComponent('digital-object:931612c16bd2a9d7b17e9d915f51fb14a63751060084adf37753a07c88200fb4');
  const response=await fetch(origin+'/api/archive/public/e108-source/history'+query), history=await response.json();
  ensure(response.status===200 && history.proposals.length===0 && history.revisions.length===1 && history.decisions.length===0 && sha(Buffer.from(history.current_revision.text))==='a4e71b7ec9e5f77b780f44447cfc8f761f8179fec753ea1b9cbf84b498997bdb', 'Main E108 source/history altered');
  const hidden=await fetch(origin+'/.private/archives-integration/publication-v30-three-live-20261004-v1/verification.json'); ensure(hidden.status===404,'Private proof exposed');
  const proof={passed:true,package:'v30',assembly_sha256:sha(assemblyBytes),origin,first,after,records,requests,main_e108_source_exact:true,private_route:404,new_posts:0,new_decisions:0,three_store_actual_stop_restart:true};
  await writeFile(resolve(out,'verification.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({passed:true,static_gets:routes.length,dynamic_gets:3,health_gets:3,stores_exact:3,new_posts:0}));
} catch(error) { await writeFile(resolve(out,'failure.json'),JSON.stringify({passed:false,message:error.message,records,requests},null,2)+'\n',{flag:'wx'}); throw error; }
