import { pathToFileURL } from 'node:url';
import { ServerlessStore } from '../hosted/serverless/store.mjs';
import { createNetworkDriver } from '../hosted/serverless/network.mjs';
import { ensure, canonical, digest } from '../contract.mjs';
import { validateSchema, validateConfiguration } from './policy.mjs';
import { validateArtifacts, loadDeliveryBundle, R1_DIGEST, literalHash } from './bundle.mjs';
export async function seedExactContext(driver,{schema,context,mandate}) {
  validateSchema(schema);const validated=validateArtifacts(context,mandate);
  const store=new ServerlessStore(driver,{schema,context:validated.context});
  await driver.transaction(async tx=>{await store.lockTransaction(tx);
    ensure((await tx.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema])).rows.length===0,409,'new_schema_required','Seeding requires a previously absent dedicated schema.');});
  await store.migrate();await store.initialize({seed:true});
  const snapshot=await store.exportSnapshot();
  ensure(snapshot.revisions.length===1 && snapshot.proposals.length===0 && snapshot.decisions.length===0 && digest(snapshot.revisions[0])===R1_DIGEST,
    503,'seed_mismatch','Exact r1 with no proposals or decisions required.');
  return {version:'archive-wip-seed-proof/v1',schema,passage_id:context.passage.passage_id,text_revision:context.initialRevision.text_revision,
    r1_canonical_sha256:R1_DIGEST,r1_text_sha256:literalHash(context),source_context_unchanged:true,rights_review:'pending',reading_status:'unreviewed',
    mandate_id:mandate.mandate_id,proposals:0,decisions:0,revisions:1,owner_credentials_created:false};
}
export async function seedConfigured(env,bundle,{driverFactory=createNetworkDriver}={}) {
  const config=validateConfiguration(env);validateArtifacts(bundle.context,bundle.mandate);
  const driver=driverFactory(config.databaseUrl);
  try{return await seedExactContext(driver,{schema:config.schema,...bundle});}finally{await driver.close();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    ensure(process.argv.length===4 && process.argv[2]==='--seed-new-schema',422,'explicit_seed_required','Use --seed-new-schema and an explicit prepared bundle directory.');
    const env=process.env;validateConfiguration(env);
    process.stdout.write(canonical(await seedConfigured(env,loadDeliveryBundle(process.argv[3])))+'\n');
  }catch{process.stderr.write('WIP seeding refused; no URL, secret or source literal is logged.\n');process.exitCode=1;}
}
