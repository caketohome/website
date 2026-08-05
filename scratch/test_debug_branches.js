const { ApiEngine } = require('./frontend/src/lib/api-engine');

const branches = ApiEngine.listBranches();
console.log("Total Branches:", branches.length);
branches.forEach(b => {
    console.log(`Branch [${b.id}] "${b.name}": phone="${b.phone}", email="${b.email}", manager_account=`, b.manager_account);
});
