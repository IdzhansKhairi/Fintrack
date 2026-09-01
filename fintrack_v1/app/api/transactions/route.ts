// app/api/transactions/route.ts
import { openDB } from "@/lib/db";
import { DashboardAdapter, TransactionsAdapter } from "@/lib/db-adapter";
import { getExpenseUsageCategory } from "@/lib/displayMappings";
import { NextRequest, NextResponse } from "next/server";

// GET - Fetch all transactions
export async function GET() {
  try {
    // Use DashboardAdapter to support dual database strategy
    const transactions = await DashboardAdapter.getTransactions();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// POST - Create a new transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transaction_date,
      transaction_time,
      transaction_description,
      transaction_amount,
      transaction_category,
      transaction_sub_category,
      transaction_card_choice,
      transaction_income_source,
      transaction_expense_usage,
      transaction_hobby_category,
      transaction_spending_beneficiary,
    } = body;

    // Automatically determine expense usage category from expense usage
    const transaction_expense_usage_category = getExpenseUsageCategory(transaction_expense_usage);

    // Ensure the transaction amount is always stored with 2 decimal places
    const roundedAmount = parseFloat(Number(transaction_amount).toFixed(2));

    // Use TransactionsAdapter to support dual database strategy
    const newTransaction = await TransactionsAdapter.create({
      transaction_date,
      transaction_time,
      transaction_description,
      transaction_amount: roundedAmount,
      transaction_category,
      transaction_sub_category,
      transaction_card_choice: transaction_card_choice || null,
      transaction_income_source: transaction_income_source || null,
      transaction_expense_usage: transaction_expense_usage || null,
      transaction_expense_usage_category: transaction_expense_usage_category || null,
      transaction_hobby_category: transaction_hobby_category || null,
      transaction_spending_beneficiary: transaction_spending_beneficiary || null,
    });

    return NextResponse.json(
      { message: "Transaction created", id: newTransaction.transaction_id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

// PUT - Update a transaction
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transaction_id,
      transaction_date,
      transaction_time,
      transaction_description,
      transaction_amount,
      transaction_category,
      transaction_sub_category,
      transaction_card_choice,
      transaction_income_source,
      transaction_expense_usage,
      transaction_hobby_category,
      transaction_spending_beneficiary,
    } = body;

    if (!transaction_id) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Automatically determine expense usage category from expense usage
    const transaction_expense_usage_category = getExpenseUsageCategory(transaction_expense_usage);

    // Ensure the transaction amount is always stored with 2 decimal places
    const roundedAmount = parseFloat(Number(transaction_amount).toFixed(2));

    // Use TransactionsAdapter to support dual database strategy
    const updatedTransaction = await TransactionsAdapter.update(transaction_id, {
      transaction_date,
      transaction_time,
      transaction_description,
      transaction_amount: roundedAmount,
      transaction_category,
      transaction_sub_category,
      transaction_card_choice: transaction_card_choice || null,
      transaction_income_source: transaction_income_source || null,
      transaction_expense_usage: transaction_expense_usage || null,
      transaction_expense_usage_category: transaction_expense_usage_category || null,
      transaction_hobby_category: transaction_hobby_category || null,
      transaction_spending_beneficiary: transaction_spending_beneficiary || null,
    });

    return NextResponse.json({
      message: "Transaction updated",
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error("Failed to update transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a transaction
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transaction_id = searchParams.get("id");

    if (!transaction_id) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Use TransactionsAdapter to support dual database strategy
    await TransactionsAdapter.delete(parseInt(transaction_id));

    return NextResponse.json({
      message: "Transaction deleted",
    });
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
