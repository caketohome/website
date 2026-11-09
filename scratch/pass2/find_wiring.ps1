$patterns = @('transferStock','inventory_transfer','PurchaseReturnService','processPurchaseReturn','PurchaseReversalService','reversePurchase','manager/inventory/damage','inventory/damage','AccountsPayableService','getSupplierStatement','/grn','inventory_movement','inventory_cost_lot')
$files = Get-ChildItem -Path frontend\src -Recurse -File -Include *.ts,*.tsx | Where-Object { $_.FullName -notmatch 'node_modules' }
foreach ($p in $patterns) {
  Write-Output "=== $p ==="
  $files | Select-String -Pattern $p -SimpleMatch | Select-Object -First 12 | ForEach-Object { "{0}:{1}: {2}" -f $_.Path.Replace((Get-Location).Path + '\frontend\src\',''), $_.LineNumber, $_.Line.Trim().Substring(0, [Math]::Min(140, $_.Line.Trim().Length)) }
}
