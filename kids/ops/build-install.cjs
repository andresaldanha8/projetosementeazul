// Consolidated installer for an EMPTY selected database. Never executes SQL.
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../migrations');
const order=['001_kids.sql','002_lookup_limits.sql','003_payment_audit.sql','004_admin_login_limits.sql','005_independent_admin.sql','006_image_authorization.sql'];
const header='-- KIDS standalone installation: EMPTY database only.\n-- Select the exclusive KIDS database in phpMyAdmin before importing.\n-- Import this file ONCE; do NOT also run migrations 001..006.\n-- No administrator, password, user import or registration fixtures.\n-- DDL is not transactionally reversible: on errors STOP and inspect the selected database.\n\n';
fs.writeFileSync(path.join(__dirname,'install-kids-empty.sql'),header+order.map(f=>'-- Source: '+f+'\n'+fs.readFileSync(path.join(dir,f),'utf8')).join('\n\n'));
console.log('Prepared kids/ops/install-kids-empty.sql; no SQL executed.');
