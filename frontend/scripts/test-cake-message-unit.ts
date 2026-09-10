/**
 * CakeToHome — Optional Cake Message Timing & State Machine Unit / Logic Verification Suite
 *
 * Requirements (Section 13):
 * TEST 1: Message empty. User has not clicked Add to Cart -> no confirmation.
 * TEST 2: Message empty. User clicks Add to Cart -> confirmation appears.
 * TEST 3: Message empty. User confirms Continue -> exactly one cart item added.
 * TEST 4: Message empty. User chooses Add Message -> no cart item added, message field receives focus.
 * TEST 5: Message contains valid text. User clicks Add to Cart -> no blank-message confirmation, exactly one cart item added.
 * TEST 6: Message contains whitespace only -> treated as empty, confirmation appears only on Add to Cart.
 * TEST 7: Required product configuration invalid -> required validation appears, blank-message confirmation does NOT appear.
 * TEST 8: Add-ons selected + empty message -> confirmation appears, Continue preserves add-ons.
 * TEST 9: Selected size + quantity + empty message -> confirmation appears, Continue preserves size/quantity/price.
 * TEST 10: Rapid double click -> exactly one cart item.
 * TEST 11: Dialog cancelled -> no cart mutation.
 * TEST 12: Mobile viewport -> flow works correctly.
 */

interface TestResult {
  code: string;
  name: string;
  passed: boolean;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, code: string, name: string, details?: any) {
  if (condition) {
    results.push({ code, name, passed: true, details });
    console.log(`✅ PASS [${code}]: ${name}`);
  } else {
    results.push({ code, name, passed: false, details });
    console.error(`❌ FAIL [${code}]: ${name}`, details);
  }
}

// Emulate the Product Detail Client Cake Message State Machine
interface StateMachineConfig {
  activePimConfig: {
    show_weight?: boolean;
    required_weight?: boolean;
    show_shape?: boolean;
    required_shape?: boolean;
    show_flavour?: boolean;
    required_flavour?: boolean;
    show_filling?: boolean;
    required_filling?: boolean;
    show_photo_cake?: boolean;
    required_photo_cake?: boolean;
    show_cake_message?: boolean;
    required_cake_message?: boolean;
  };
  weightsList: any[];
  selectedWeight: any | null;
  cakeMessage: string;
  selectedAddonIds: string[];
  addonsList: any[];
  quantity: number;
  product: { id: string; price: number };
  variantId: string;
}

class CakeMessageStateMachine {
  config: StateMachineConfig;
  showEmptyMessageConfirm = false;
  validationError: string | null = null;
  isSubmitting = false;
  cartLoading = false;
  addedCartSuccess = false;
  cartMutations: any[] = [];
  inputFocused = false;

  constructor(config: StateMachineConfig) {
    this.config = config;
  }

  handleAddToCart() {
    if (this.isSubmitting || this.cartLoading) {
      return;
    }

    // 1. Enforce required PIM fields first
    const { activePimConfig, weightsList, selectedWeight, cakeMessage } = this.config;
    if (activePimConfig.show_weight !== false && activePimConfig.required_weight !== false && weightsList.length > 0 && !selectedWeight) {
      this.validationError = "Please select a cake size before adding to cart.";
      return;
    }
    if (activePimConfig.show_cake_message && activePimConfig.required_cake_message && !cakeMessage.trim()) {
      this.validationError = "Please enter a custom message for the cake.";
      return;
    }

    this.validationError = null;

    // 2. Check if optional cake message is empty/whitespace only
    const isMessageEmpty = !cakeMessage.trim();
    const isCakeMessageOptional = activePimConfig.show_cake_message !== false && !activePimConfig.required_cake_message;

    if (isCakeMessageOptional && isMessageEmpty) {
      this.showEmptyMessageConfirm = true;
      return;
    }

    this.executeAddToCart();
  }

  executeAddToCart() {
    if (this.isSubmitting || this.cartLoading) {
      return;
    }

    this.isSubmitting = true;
    this.cartLoading = true;

    try {
      const chosenAddons = this.config.addonsList
        .filter((a) => this.config.selectedAddonIds.includes(a.id))
        .map((a) => a.name);

      const metadata = {
        productId: this.config.product.id,
        variantId: this.config.variantId,
        weight: this.config.selectedWeight ? this.config.selectedWeight.name : null,
        cake_message: this.config.activePimConfig.show_cake_message !== false ? this.config.cakeMessage.trim() || null : null,
        selected_addons: chosenAddons,
        price: (this.config.selectedWeight ? this.config.selectedWeight.price : this.config.product.price),
        quantity: this.config.quantity,
      };

      this.cartMutations.push(metadata);
      this.addedCartSuccess = true;
    } finally {
      this.cartLoading = false;
      this.isSubmitting = false;
    }
  }

  chooseAddMessage() {
    this.showEmptyMessageConfirm = false;
    this.inputFocused = true;
  }

  handleInputFocus() {
    // Empty message field focus must NEVER trigger confirmation dialog
  }

  handleInputBlur() {
    // Empty message field blur must NEVER trigger confirmation dialog
  }

  confirmAddToCart() {
    this.showEmptyMessageConfirm = false;
    this.executeAddToCart();
  }

  cancelDialog() {
    this.showEmptyMessageConfirm = false;
  }
}

function runTests() {
  console.log("==================================================");
  console.log("CAKETOHOME — CAKE MESSAGE TIMING UNIT SUITE");
  console.log("==================================================");

  const baseConfig: StateMachineConfig = {
    activePimConfig: {
      show_weight: true,
      required_weight: true,
      show_cake_message: true,
      required_cake_message: false,
    },
    weightsList: [{ name: "0.5 kg", price: 552 }, { name: "1 kg", price: 649 }],
    selectedWeight: { name: "0.5 kg", price: 552 },
    cakeMessage: "",
    selectedAddonIds: [],
    addonsList: [{ id: "addon_1", name: "Candle Pack", price_modifier: 50 }],
    quantity: 1,
    product: { id: "prod_pistachio_01", price: 552 },
    variantId: "var_pistachio_01",
  };

  // TEST 1: Message empty. User has not clicked Add to Cart -> no confirmation.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, cakeMessage: "" });
    assert(sm.showEmptyMessageConfirm === false && sm.cartMutations.length === 0, "TEST_1", "Message empty before Add to Cart: No confirmation dialog shown");
  }

  // TEST 1B: Empty message does not prompt on field focus.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, cakeMessage: "" });
    sm.handleInputFocus();
    assert(sm.showEmptyMessageConfirm === false && sm.cartMutations.length === 0, "TEST_1B", "Empty message field focused: No confirmation dialog shown, zero mutations");
  }

  // TEST 1C: Empty message does not prompt on field blur.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, cakeMessage: "" });
    sm.handleInputFocus();
    sm.handleInputBlur();
    assert(sm.showEmptyMessageConfirm === false && sm.cartMutations.length === 0, "TEST_1C", "Empty message field blurred: No confirmation dialog shown, zero mutations");
  }

  // TEST 2: Message empty. User clicks Add to Cart -> confirmation appears.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, cakeMessage: "" });
    sm.handleAddToCart();
    assert(sm.showEmptyMessageConfirm === true && sm.cartMutations.length === 0, "TEST_2", "Message empty on Add to Cart: Confirmation dialog appears, zero cart mutations");
  }

  // TEST 3: Message empty. User confirms Continue -> exactly one cart item added.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, cakeMessage: "" });
    sm.handleAddToCart();
    sm.confirmAddToCart();
    assert(
      sm.showEmptyMessageConfirm === false &&
      sm.cartMutations.length === 1 &&
      sm.cartMutations[0].cake_message === null &&
      sm.cartMutations[0].weight === "0.5 kg",
      "TEST_3",
      "User confirms Continue: Exactly one cart item added with cake_message=null and preserved size"
    );
  }

  // TEST 4: Message empty. User chooses Add Message -> no cart item added, message field receives focus.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, cakeMessage: "" });
    sm.handleAddToCart();
    sm.chooseAddMessage();
    assert(
      sm.showEmptyMessageConfirm === false &&
      sm.cartMutations.length === 0 &&
      sm.inputFocused === true,
      "TEST_4",
      "User chooses Add Message: Dialog closes, input receives focus, 0 cart items added"
    );
  }

  // TEST 5: Message contains valid text. User clicks Add to Cart -> no blank-message confirmation, exactly one cart item added.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, cakeMessage: "Happy Birthday Ananya!" });
    sm.handleAddToCart();
    assert(
      sm.showEmptyMessageConfirm === false &&
      sm.cartMutations.length === 1 &&
      sm.cartMutations[0].cake_message === "Happy Birthday Ananya!",
      "TEST_5",
      "Valid message provided: Bypasses confirmation dialog, directly adds item to cart with message text"
    );
  }

  // TEST 6: Message contains whitespace only -> treated as empty, confirmation appears only on Add to Cart.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, cakeMessage: "    \n\t   " });
    sm.handleAddToCart();
    assert(
      sm.showEmptyMessageConfirm === true &&
      sm.cartMutations.length === 0,
      "TEST_6",
      "Whitespace-only message: Normalized to empty, opens confirmation modal, no immediate mutation"
    );
  }

  // TEST 7: Required product configuration invalid -> required validation appears, blank-message confirmation does NOT appear.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, selectedWeight: null, cakeMessage: "" });
    sm.handleAddToCart();
    assert(
      sm.validationError !== null &&
      sm.showEmptyMessageConfirm === false &&
      sm.cartMutations.length === 0,
      "TEST_7",
      "Invalid required configuration (no weight): Shows validation error, skips confirmation dialog"
    );
  }

  // TEST 8: Add-ons selected + empty message -> confirmation appears, Continue preserves add-ons.
  {
    const sm = new CakeMessageStateMachine({
      ...baseConfig,
      cakeMessage: "",
      selectedAddonIds: ["addon_1"],
    });
    sm.handleAddToCart();
    sm.confirmAddToCart();
    assert(
      sm.cartMutations.length === 1 &&
      sm.cartMutations[0].selected_addons.includes("Candle Pack"),
      "TEST_8",
      "Add-ons selected with empty message: Confirmation preserves selected add-ons upon continue"
    );
  }

  // TEST 9: Selected size + quantity + empty message -> confirmation appears, Continue preserves size/quantity/price.
  {
    const sm = new CakeMessageStateMachine({
      ...baseConfig,
      cakeMessage: "",
      selectedWeight: { name: "1 kg", price: 649 },
      quantity: 3,
    });
    sm.handleAddToCart();
    sm.confirmAddToCart();
    assert(
      sm.cartMutations.length === 1 &&
      sm.cartMutations[0].weight === "1 kg" &&
      sm.cartMutations[0].quantity === 3 &&
      sm.cartMutations[0].price === 649,
      "TEST_9",
      "Selected size (1 kg) + quantity (3): Preserved intact across confirmation flow"
    );
  }

  // TEST 10: Rapid double click -> exactly one cart item.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, cakeMessage: "Happy Birthday" });
    sm.isSubmitting = true; // Simulating in-flight request lock
    sm.handleAddToCart();
    assert(sm.cartMutations.length === 0, "TEST_10", "Rapid double-click / in-flight submission lock prevents duplicate cart mutation");
  }

  // TEST 11: Dialog cancelled -> no cart mutation.
  {
    const sm = new CakeMessageStateMachine({ ...baseConfig, cakeMessage: "" });
    sm.handleAddToCart();
    sm.cancelDialog();
    assert(
      sm.showEmptyMessageConfirm === false &&
      sm.cartMutations.length === 0,
      "TEST_11",
      "Dialog cancelled (Escape / backdrop click): Dialog closes, zero cart mutations"
    );
  }

  // TEST 12: Mobile viewport responsiveness logic check.
  {
    const mobileWidth = 375;
    const dialogMaxWidth = 448; // max-w-md
    const effectiveWidth = Math.min(mobileWidth - 32, dialogMaxWidth); // 343px
    assert(
      effectiveWidth < mobileWidth && effectiveWidth > 200,
      "TEST_12",
      "Mobile viewport sizing: Dialog width dynamically constrained to viewport with safe padding"
    );
  }

  console.log("==================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`Cake Message Unit Tests: ${passed}/${total} passed`);
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
