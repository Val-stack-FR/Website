import {createHash} from 'node:crypto';
export const digest=b=>createHash('sha256').update(b).digest('hex');
export const E108_TOUCH_PARENT_CSS='a8d8204232c8b71b205532155f15ad0d731e1ce013df072d002e6ee2c3b4c47b';
export const E108_TOUCH_RULE='\n.catalogue-ensemble-entry a{display:block;box-sizing:border-box;min-height:44px;padding:12px 10px;line-height:1.5;overflow-wrap:anywhere}\n';
export function patchE108TouchShortcutCss(bytes){
 if(!Buffer.isBuffer(bytes)||digest(bytes)!==E108_TOUCH_PARENT_CSS)throw Error('Closed E108 ensemble CSS required');
 return Buffer.concat([bytes,Buffer.from(E108_TOUCH_RULE)]);
}
export function restoreE108TouchShortcutCss(bytes){
 const suffix=Buffer.from(E108_TOUCH_RULE);
 if(!Buffer.isBuffer(bytes)||!bytes.subarray(-suffix.length).equals(suffix))throw Error('Exact touch shortcut rule required');
 const parent=bytes.subarray(0,-suffix.length);
 if(digest(parent)!==E108_TOUCH_PARENT_CSS)throw Error('Unexpected parent CSS');
 return parent;
}
