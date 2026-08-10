/**
 * CakeToHome — Customer GST & Taxpayer Service
 * Handles B2B vs B2C customer classification, 15-character GSTIN regex validation,
 * state code extraction, and legal business entity resolution.
 */

export interface CustomerGstProfile {
  id: string;
  customerType: "B2B" | "B2C" | "EXPORT";
  gstin?: string;
  legalBusinessName?: string;
  tradeName?: string;
  stateCode: string;
  stateName: string;
  isValidGstin: boolean;
  validationError?: string;
}

export class CustomerGstService {
  // Regex pattern for 15-character Indian GSTIN: e.g. 29AAAAA0000A1Z5
  public static GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  public static STATE_CODE_NAME_MAP: Record<string, string> = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "19": "West Bengal",
    "24": "Gujarat",
    "27": "Maharashtra",
    "29": "Karnataka",
    "30": "Goa",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "36": "Telangana",
    "37": "Andhra Pradesh",
  };

  /**
   * Validate Indian 15-character GSTIN format
   */
  public static validateGstin(gstin?: string): { isValid: boolean; stateCode?: string; error?: string } {
    if (!gstin || gstin.trim() === "" || gstin.trim().toUpperCase() === "URP") {
      return { isValid: false, error: "Unregistered Consumer (URP)" };
    }

    const cleanGstin = gstin.trim().toUpperCase();

    if (cleanGstin.length !== 15) {
      return { isValid: false, error: "GSTIN must be exactly 15 alphanumeric characters long." };
    }

    if (!this.GSTIN_REGEX.test(cleanGstin)) {
      return { isValid: false, error: "Invalid GSTIN format structure." };
    }

    const stateCode = cleanGstin.slice(0, 2);
    if (!this.STATE_CODE_NAME_MAP[stateCode]) {
      return { isValid: false, stateCode, error: `Invalid GST state code prefix: '${stateCode}'` };
    }

    return { isValid: true, stateCode };
  }

  /**
   * Build complete Customer GST profile
   */
  public static resolveCustomerProfile(data: {
    id?: string;
    customerType?: "B2B" | "B2C" | "EXPORT";
    gstin?: string;
    legalBusinessName?: string;
    tradeName?: string;
    stateCode?: string;
  }): CustomerGstProfile {
    const rawGstin = data.gstin ? data.gstin.trim().toUpperCase() : undefined;
    const valResult = this.validateGstin(rawGstin);

    const isB2b = data.customerType === "B2B" || valResult.isValid;
    const customerType = isB2b ? "B2B" : data.customerType || "B2C";
    const stateCode = valResult.stateCode || data.stateCode || "29";
    const stateName = this.STATE_CODE_NAME_MAP[stateCode] || "Karnataka";

    return {
      id: data.id || "cust_guest",
      customerType,
      gstin: valResult.isValid ? rawGstin : "URP",
      legalBusinessName: data.legalBusinessName || undefined,
      tradeName: data.tradeName || undefined,
      stateCode,
      stateName,
      isValidGstin: valResult.isValid,
      validationError: valResult.error,
    };
  }
}
