// app/api/accounts/route.ts
import { AccountsAdapter } from "@/lib/db-adapter";
import { NextRequest, NextResponse } from "next/server";

// GET - Fetch all account balances
export async function GET() {
  try {
    // Use AccountsAdapter to support dual database strategy
    const accounts = await AccountsAdapter.getAll();
    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

// PUT - Update an account balance
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { account_id, current_balance } = body;

    if (!account_id || current_balance === undefined) {
      return NextResponse.json(
        { error: "account_id and current_balance are required" },
        { status: 400 }
      );
    }

    // Ensure the balance is always stored with 2 decimal places
    const roundedBalance = parseFloat(Number(current_balance).toFixed(2));

    // Use AccountsAdapter to support dual database strategy
    await AccountsAdapter.updateBalance(account_id, roundedBalance);

    return NextResponse.json({ message: "Account balance updated" });
  } catch (error) {
    console.error("Failed to update account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}
