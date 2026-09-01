import { NextResponse } from "next/server";
import { DebtsAdapter } from "@/lib/db-adapter";

// GET - Fetch all debts or filter by status and type
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const type = searchParams.get('type');

        const filters: any = {};
        if (status) filters.status = status;
        if (type) filters.type = type;

        // Use DebtsAdapter to support dual database strategy
        const debts = await DebtsAdapter.getAll(filters);

        return NextResponse.json(debts);
    } catch (error) {
        console.error('Failed to fetch debts:', error);
        return NextResponse.json({ error: 'Failed to fetch debts' }, { status: 500 });
    }
}

// POST - Create a new debt
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            debt_type,
            created_date,
            due_date,
            person_name,
            amount,
            notes,
            status,
            settled_date
        } = body;

        // Round amount to 2 decimal places
        const roundedAmount = parseFloat(Number(amount).toFixed(2));

        // Use DebtsAdapter to support dual database strategy
        const newDebt = await DebtsAdapter.create({
            debt_type,
            created_date,
            due_date: due_date || null,
            person_name,
            amount: roundedAmount,
            notes: notes || null,
            status: status || 'pending',
            settled_date: settled_date || null
        });

        return NextResponse.json({ success: true, debt_id: newDebt.debt_id });
    } catch (error) {
        console.error('Failed to create debt:', error);
        return NextResponse.json({ error: 'Failed to create debt' }, { status: 500 });
    }
}

// PUT - Update an existing debt
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const {
            debt_id,
            debt_type,
            created_date,
            due_date,
            person_name,
            amount,
            notes,
            status,
            settled_date
        } = body;

        // Round amount to 2 decimal places
        const roundedAmount = parseFloat(Number(amount).toFixed(2));

        // Use DebtsAdapter to support dual database strategy
        await DebtsAdapter.update(debt_id, {
            debt_type,
            created_date,
            due_date: due_date || null,
            person_name,
            amount: roundedAmount,
            notes: notes || null,
            status,
            settled_date: settled_date || null
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update debt:', error);
        return NextResponse.json({ error: 'Failed to update debt' }, { status: 500 });
    }
}

// DELETE - Delete a debt
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const debt_id = searchParams.get('id');

        if (!debt_id) {
            return NextResponse.json({ error: 'Debt ID required' }, { status: 400 });
        }

        // Use DebtsAdapter to support dual database strategy
        await DebtsAdapter.delete(parseInt(debt_id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete debt:', error);
        return NextResponse.json({ error: 'Failed to delete debt' }, { status: 500 });
    }
}
