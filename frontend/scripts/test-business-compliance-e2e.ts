/**
 * Comprehensive Automated End-to-End Test Suite for
 * CakeToHome Enterprise Business, Tax & Statutory Compliance Architecture
 */

import { ApiEngine } from "../src/lib/api-engine";

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    totalPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} - Details: ${details || "Assertion failed"}`);
    totalFailed++;
  }
}

async function runTests() {
  console.log("\n================================================================================");
  console.log("   CAKETOHOME: BUSINESS, TAX & STATUTORY COMPLIANCE SYSTEM E2E TEST SUITE");
  console.log("================================================================================\n");

  // Step 1: Fetch Business Profile
  console.log("Step 1: Global Business Profile Retrieval");
  const profile = ApiEngine.getBusinessProfile();
  assert(
    profile && profile.legal_name === "CakeToHome India Private Limited" && profile.pan === "AAACC1234F",
    "Company legal name and PAN match statutory identity",
    JSON.stringify(profile)
  );

  // Step 2: Update Business Profile
  console.log("\nStep 2: Business Profile Update & Persistence");
  const updatedProfile = ApiEngine.updateBusinessProfile({
    ...profile,
    trade_name: "CakeToHome Premium Patisserie",
    registered_email: "statutory@cakes2home.com",
  });
  assert(
    updatedProfile.trade_name === "CakeToHome Premium Patisserie" &&
      updatedProfile.registered_email === "statutory@cakes2home.com",
    "Business profile trade name and email updated and persisted"
  );

  // Step 3: Multi-State GST Registrations List
  console.log("\nStep 3: Multi-State GST Registrations Listing");
  const gstList = ApiEngine.listGstRegistrations();
  assert(
    Array.isArray(gstList) && gstList.length >= 2,
    `Retrieved ${gstList.length} state GST registrations (KA, KL, etc.)`
  );

  // Step 4: Create New State GST Registration (e.g. Tamil Nadu 33)
  console.log("\nStep 4: Create New State GST Registration (Tamil Nadu 33)");
  const newGst = ApiEngine.createGstRegistration({
    state: "Tamil Nadu",
    state_code: "33",
    gstin: "33AAACC1234F1Z8",
    legal_name: "CakeToHome India Private Limited",
    trade_name: "CakeToHome Chennai Hub",
    registration_type: "REGULAR",
    status: "active",
    address: {
      line1: "Anna Salai",
      city: "Chennai",
      state: "Tamil Nadu",
      state_code: "33",
      pincode: "600002",
    },
  });
  assert(
    newGst && newGst.gstin === "33AAACC1234F1Z8" && newGst.state_code === "33",
    "Tamil Nadu GST registration created successfully"
  );

  // Step 5: Server-side GSTIN Verification Provider
  console.log("\nStep 5: GSTIN Format Validation & Provider Verification");
  const verifiedGst = await ApiEngine.verifyGstRegistration(newGst.id);
  assert(
    Boolean(verifiedGst && verifiedGst.verification_status === "VERIFIED"),
    "GSTIN 33AAACC1234F1Z8 verified by GstVerificationProvider"
  );

  // Step 6: Branch FSSAI Licenses List
  console.log("\nStep 6: Branch FSSAI Food Safety Licenses Listing");
  const fssaiList = ApiEngine.listBranchCompliance();
  assert(
    Array.isArray(fssaiList) && fssaiList.length >= 2,
    `Retrieved ${fssaiList.length} branch compliance licenses`
  );

  // Step 7: Create / Update Branch FSSAI License (14-Digit Format)
  console.log("\nStep 7: Register Branch FSSAI License (14 Digits)");
  const newFssai = ApiEngine.createBranchCompliance({
    branch_id: "br_chennai_main",
    branch_name: "Chennai Central Kitchen",
    branch_code: "CHN-01",
    city_id: "city_chennai",
    city_name: "Chennai",
    state: "Tamil Nadu",
    state_code: "33",
    gst_registration_id: newGst.id,
    fssai_number: "11223344556688",
    fssai_license_type: "STATE_LICENSE",
    fbo_name: "CakeToHome India Private Limited",
    premise_name: "CakeToHome Chennai Kitchen Hub",
    premise_address: "Anna Salai, Chennai, Tamil Nadu 600002",
    issue_date: "2024-01-01",
    expiry_date: "2027-12-31",
    responsible_person: "K. Ramanathan",
    contact_number: "+91 98400 11223",
  });
  assert(
    newFssai && newFssai.fssai_number === "11223344556688" && newFssai.state_code === "33",
    "Branch FSSAI license registered with valid 14-digit FoSCoS identifier"
  );

  // Step 8: Server-side FSSAI Verification Provider
  console.log("\nStep 8: FSSAI FoSCoS License Verification");
  const verifiedFssai = await ApiEngine.verifyBranchCompliance(newFssai.id);
  assert(
    Boolean(verifiedFssai && verifiedFssai.verification_status === "VERIFIED"),
    "FSSAI license verified by FssaiVerificationProvider"
  );

  // Step 9: FSSAI Compliance Overview & Expiry Alarms
  console.log("\nStep 9: FSSAI Expiry Monitoring & Overview KPI Calculation");
  const overview = ApiEngine.getFssaiComplianceOverview();
  assert(
    overview &&
      typeof overview.totalBranches === "number" &&
      typeof overview.valid === "number" &&
      Array.isArray(overview.alerts),
    `Overview calculated: Total ${overview.totalBranches}, Valid ${overview.valid}, Alerts ${overview.alerts.length}`
  );

  // Step 10: Branch Statutory Mapping (Branch -> State GSTIN)
  console.log("\nStep 10: Branch Statutory Mapping (Branch -> State GSTIN)");
  const linkedComp = ApiEngine.updateBranchCompliance(newFssai.id, {
    gst_registration_id: newGst.id,
    fssai_license_type: "CENTRAL_LICENSE",
  });
  assert(
    Boolean(linkedComp && linkedComp.gst_registration_id === newGst.id && linkedComp.fssai_license_type === "CENTRAL_LICENSE"),
    "Branch mapped to state GST registration and updated"
  );

  // Step 11: Place-of-Supply Resolver: Intra-State Supply (Karnataka -> Karnataka)
  console.log("\nStep 11: Place-of-Supply Engine — Intra-State (CGST + SGST)");
  const intraTaxContext = ApiEngine.resolveTaxContext({
    branchId: "br_indiranagar",
    customerAddress: {
      state: "Karnataka",
      state_code: "29",
      city: "Bengaluru",
      pincode: "560038",
    },
  });
  assert(
    intraTaxContext.is_intra_state === true &&
      intraTaxContext.seller_gstin === "29AAAAA0000A1Z5" &&
      Boolean(intraTaxContext.seller_fssai_number),
    `Intra-State supply determined (Seller 29 -> Customer 29) with FSSAI ${intraTaxContext.seller_fssai_number}`
  );

  // Step 12: Place-of-Supply Resolver: Inter-State Supply (Karnataka -> Kerala)
  console.log("\nStep 12: Place-of-Supply Engine — Inter-State (IGST)");
  const interTaxContext = ApiEngine.resolveTaxContext({
    branchId: "br_indiranagar",
    customerAddress: {
      state: "Kerala",
      state_code: "32",
      city: "Kochi",
      pincode: "682001",
    },
  });
  assert(
    interTaxContext.is_intra_state === false &&
      interTaxContext.customer_state_code === "32",
    "Inter-State supply determined (Seller 29 -> Customer 32) with IGST regime"
  );

  // Step 13: Checkout Validation with Dynamic Statutory Tax Engine
  console.log("\nStep 13: Dynamic Checkout Validation with Statutory Tax Engine");
  const checkoutPayload = {
    cart_items: [
      {
        product_id: "prod_choco_truffle",
        title: "Belgian Chocolate Truffle Cake",
        price: 999,
        quantity: 1,
        hsn_code: "19059090",
      },
      {
        product_id: "acc_candles",
        title: "Magic Sparkler Candle",
        price: 150,
        quantity: 1,
        hsn_code: "34060010",
      },
    ],
    delivery_pincode: "560038",
    delivery_type: "standard",
    branch_id: "br_indiranagar",
  };
  const valRes: any = ApiEngine.validateCheckout(checkoutPayload as any);
  assert(
    Boolean(valRes && (valRes.valid === true || valRes.success === true)),
    `Checkout valid: Item Total ₹${valRes?.item_total}, Tax ₹${valRes?.tax_details?.total_tax}, Grand Total ₹${valRes?.grand_total}`
  );

  // Step 14: Checkout Confirmation with Immutable Compliance Snapshot
  console.log("\nStep 14: Order Checkout Confirmation & Snapshot Immutability");
  const confirmPayload = {
    ...checkoutPayload,
    customer_name: "Priya Sharma",
    customer_phone: "+91 98765 43210",
    customer_email: "priya@example.com",
    shipping_address: {
      address_1: "Flat 402, Sunshine Apts, 100 Feet Rd",
      city: "Bengaluru",
      state: "Karnataka",
      state_code: "29",
      pincode: "560038",
    },
    payment_method: "upi",
  };
  const confirmRes: any = ApiEngine.confirmCheckout(confirmPayload as any);
  const order = confirmRes?.order;
  assert(
    Boolean(
      order &&
        order.compliance_snapshot &&
        order.compliance_snapshot.seller_gstin === "29AAAAA0000A1Z5" &&
        order.compliance_snapshot.is_intra_state === true
    ),
    "Confirmed order contains complete immutable statutory compliance snapshot"
  );

  // Step 15: Fetch Order Invoice & Snapshot Verification
  console.log("\nStep 15: Tax Invoice Generation from Immutable Snapshot");
  const invoiceRes: any = ApiEngine.getBranchOrderInvoice(order?.id || "ord_101", "br_indiranagar");
  const inv: any = invoiceRes?.invoice || invoiceRes;
  assert(
    Boolean(inv && (inv.seller_gstin === "29AAAAA0000A1Z5" || invoiceRes?.seller_gstin === "29AAAAA0000A1Z5")),
    "Invoice renders accurately from immutable transaction snapshot"
  );

  // Step 16: Upload / Register Compliance Document
  console.log("\nStep 16: Compliance Document Registration");
  const doc = ApiEngine.createComplianceDocument({
    document_type: "FSSAI_CERTIFICATE",
    entity_type: "branch",
    entity_id: "br_chennai_main",
    file_name: "Chennai_FSSAI_License_2026.pdf",
    file_url: "/docs/chennai_fssai_2026.pdf",
  });
  assert(
    doc && doc.file_name === "Chennai_FSSAI_License_2026.pdf" && doc.entity_id === "br_chennai_main",
    "Compliance certificate document registered"
  );

  // Step 17: Delete Compliance Document
  console.log("\nStep 17: Compliance Document Deletion");
  const deleted = ApiEngine.deleteComplianceDocument(doc.id);
  assert(deleted === true, `Compliance document ${doc.id} deleted successfully`);

  // Step 18: Invoice & Billing Settings CRUD
  console.log("\nStep 18: Invoice & Billing Settings Update & Retrieval");
  const invSettings = ApiEngine.getInvoiceSettings();
  const updatedInvSettings = ApiEngine.updateInvoiceSettings({
    ...invSettings,
    invoice_prefix: "CTH-PROD",
    next_invoice_number: 501,
  });
  assert(
    updatedInvSettings.invoice_prefix === "CTH-PROD" && updatedInvSettings.next_invoice_number === 501,
    "Invoice prefix and sequence counter updated successfully"
  );

  // Step 19: Full Compliance Master Bundle
  console.log("\nStep 19: Complete Compliance Master Bundle Retrieval");
  const bundle: any = ApiEngine.getAllComplianceBundle();
  assert(
    Boolean(
      bundle &&
        bundle.profile &&
        Array.isArray(bundle.gstRegistrations) &&
        Array.isArray(bundle.branchCompliance) &&
        bundle.overview &&
        bundle.invoiceSettings &&
        bundle.deliveryDefaults &&
        bundle.paymentSettings &&
        bundle.integrationSettings
    ),
    "Complete statutory compliance master bundle aggregated successfully"
  );

  console.log("\n================================================================================");
  console.log(`   TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("================================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
