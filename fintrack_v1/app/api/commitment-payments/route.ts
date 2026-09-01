import { NextResponse } from "next/server";
import { CommitmentPaymentsAdapter } from "@/lib/db-adapter";

// GET - Fetch payment status for a specific month/year or commitment
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');
        const year = searchParams.get('year');
        const commitment_id = searchParams.get('commitment_id');

        const filters: any = {};
        if (month) filters.month = parseInt(month);
        if (year) filters.year = parseInt(year);
        if (commitment_id) filters.commitment_id = parseInt(commitment_id);

        // Use CommitmentPaymentsAdapter to support dual database strategy
        const payments = await CommitmentPaymentsAdapter.getAll(filters);

        return NextResponse.json(payments);
    } catch (error) {
        console.error('Failed to fetch commitment payments:', error);
        return NextResponse.json({ error: 'Failed to fetch commitment payments' }, { status: 500 });
    }
}

// POST - Create or update payment status
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { commitment_id, payment_month, payment_year, payment_status } = body;

        // Use CommitmentPaymentsAdapter to support dual database strategy
        await CommitmentPaymentsAdapter.upsert({
            commitment_id,
            payment_month,
            payment_year,
            payment_status: payment_status ? 1 : 0
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update commitment payment:', error);
        return NextResponse.json({ error: 'Failed to update commitment payment' }, { status: 500 });
    }
}

// PUT - Update payment status (toggle)
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { commitment_id, payment_month, payment_year, payment_status } = body;

        // Use CommitmentPaymentsAdapter to support dual database strategy
        await CommitmentPaymentsAdapter.upsert({
            commitment_id,
            payment_month,
            payment_year,
            payment_status: payment_status ? 1 : 0
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update payment status:', error);
        return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
    }
}

// DELETE - Delete payment status record
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const payment_id = searchParams.get('id');

        if (!payment_id) {
            return NextResponse.json({ error: 'Payment ID required' }, { status: 400 });
        }

        // Use CommitmentPaymentsAdapter to support dual database strategy
        await CommitmentPaymentsAdapter.delete(parseInt(payment_id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete payment status:', error);
        return NextResponse.json({ error: 'Failed to delete payment status' }, { status: 500 });
    }
}
