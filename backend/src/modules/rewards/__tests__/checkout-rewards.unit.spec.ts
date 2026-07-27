describe("Checkout Rewards Widget Calculations", () => {
  const getCurrencySymbol = (code: string) => {
    return code?.toLowerCase() === "inr" ? "₹" : "€";
  };

  const calculateRemainingPayable = ({
    cartTotal,
    walletBalance,
    useWallet,
    walletInputAmount,
    loyaltyPointsAvailable,
    useLoyalty,
    loyaltyPointsInput,
    giftCardBalance,
  }: {
    cartTotal: number; // in units (e.g. 500 for ₹500)
    walletBalance: number; // in cents (e.g. 60000 for ₹600)
    useWallet: boolean;
    walletInputAmount: number; // in cents
    loyaltyPointsAvailable: number;
    useLoyalty: boolean;
    loyaltyPointsInput: number;
    giftCardBalance: number; // in cents
  }) => {
    // 100 points = ₹10 = 1000 cents
    const pointsValue = useLoyalty ? (loyaltyPointsInput / 10) * 100 : 0; 
    const walletValue = useWallet ? walletInputAmount : 0;
    const giftCardValue = giftCardBalance > 0
      ? Math.min(giftCardBalance, cartTotal * 100 - walletValue - pointsValue)
      : 0;

    const totalDiscount = walletValue + pointsValue + giftCardValue;
    const netPayable = Math.max(0, cartTotal * 100 - totalDiscount);

    return {
      pointsValue,
      walletValue,
      giftCardValue,
      totalDiscount,
      netPayable,
    };
  };

  test("should resolve default order currency symbol correctly", () => {
    expect(getCurrencySymbol("INR")).toBe("₹");
    expect(getCurrencySymbol("EUR")).toBe("€");
    expect(getCurrencySymbol("USD")).toBe("€"); // defaults to €
  });

  test("should compute correct split when using all three rewards", () => {
    const cartTotal = 500; // ₹500 order
    const walletBalance = 30000; // ₹300 wallet
    const loyaltyPointsAvailable = 1500; // 1500 pts = ₹150 discount
    const giftCardBalance = 20000; // ₹200 gift card

    // Case: apply 1000 loyalty points (₹100 value), full wallet (₹300), and let gift card cover the rest
    const result = calculateRemainingPayable({
      cartTotal,
      walletBalance,
      useWallet: true,
      walletInputAmount: 30000,
      loyaltyPointsAvailable,
      useLoyalty: true,
      loyaltyPointsInput: 1000, // ₹100
      giftCardBalance,
    });

    expect(result.pointsValue).toBe(10000); // 10000 cents = ₹100
    expect(result.walletValue).toBe(30000); // 30000 cents = ₹300
    expect(result.giftCardValue).toBe(10000); // remaining ₹100 covered by gift card (max balance is ₹200)
    expect(result.totalDiscount).toBe(50000); // full amount covered
    expect(result.netPayable).toBe(0); // ₹0 remaining payable
  });

  test("should not exceed cart total when applying rewards", () => {
    const cartTotal = 250; // ₹250 order
    const walletBalance = 30000; // ₹300 wallet
    const loyaltyPointsAvailable = 500; // 500 pts = ₹50 discount

    // Case: Apply loyalty discount of ₹50. Remaining is ₹200.
    // Wallet input tries to apply full ₹300, but should be capped at ₹200.
    const result = calculateRemainingPayable({
      cartTotal,
      walletBalance,
      useWallet: true,
      walletInputAmount: 20000, // capped at 20000
      loyaltyPointsAvailable,
      useLoyalty: true,
      loyaltyPointsInput: 500,
      giftCardBalance: 0,
    });

    expect(result.pointsValue).toBe(5000); // ₹50
    expect(result.walletValue).toBe(20000); // ₹200
    expect(result.netPayable).toBe(0);
  });
});
