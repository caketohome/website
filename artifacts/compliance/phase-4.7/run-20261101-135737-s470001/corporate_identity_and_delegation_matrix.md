# Corporate Identity and Delegation Matrix
**Legal Entity:** CakeToHome India Private Limited  
**CIN:** U15400KA2026PTC189211  
**GSTIN:** `29AABCC1234F1Z5`  

## Role Matrix & Segregation of Duties
| Role | Permitted Actions | Prohibited Actions | Dual-Control Rule |
| :--- | :--- | :--- | :--- |
| **Board Director** | Adopt Resolutions, Authorize Officers | Direct Sequence Allocation | Cannot self-approve own filings |
| **Finance Approver** | Review Evidence, Approve Configurations | Propose Configurations, Code Deployments | Cannot approve own proposals |
| **Finance Operator** | Submit Evidence, Propose Series | Final Approval, Release Gate Activation | Submitter cannot be approver |
| **Developer / SysAdmin** | Code Engineering, DB Rehearsals | Corporate Authorization, Series Approval | Strict lockout from approval APIs |
