import { NextResponse } from "next/server";
import { FinancingInstallmentsAdapter } from "@/lib/db-adapter";

// GET - Fetch installments for a financing plan or upcoming installments for a month
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const financingId = searchParams.get('financing_id');
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        if (financingId) {
            // Get installments for a specific financing plan
            const installments = await FinancingInstallmentsAdapter.getByFinancingId(parseInt(financingId));
            return NextResponse.json(installments);
        } else if (month !== null && year !== null) {
            // Get upcoming installments for a specific month/year
            const installments = await FinancingInstallmentsAdapter.getUpcoming(
                parseInt(month),
                parseInt(year)
            );
            return NextResponse.json(installments);
        } else {
            return NextResponse.json({ error: 'Either financing_id or month+year parameters required' }, { status: 400 });
        }
    } catch (error) {
        console.error('Failed to fetch installments:', error);
        return NextResponse.json({ error: 'Failed to fetch installments' }, { status: 500 });
    }
}

// POST - Bulk create installments for a financing plan
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { financing_id, installments } = body;

        if (!financing_id || !installments || !Array.isArray(installments)) {
            return NextResponse.json({ error: 'financing_id and installments array required' }, { status: 400 });
        }

        // Round amounts and prepare installment data
        const preparedInstallments = installments.map((inst: any) => ({
            financing_id,
            installment_number: inst.installment_number,
            due_date: inst.due_date,
            amount_due: parseFloat(Number(inst.amount_due).toFixed(2)),
            amount_paid: 0,
            payment_status: 'pending',
            paid_date: null,
            notes: inst.notes || null
        }));

        const result = await FinancingInstallmentsAdapter.bulkCreate(preparedInstallments);

        return NextResponse.json({ success: true, count: result.length });
    } catch (error) {
        console.error('Failed to create installments:', error);
        return NextResponse.json({ error: 'Failed to create installments' }, { status: 500 });
    }
}

// PUT - Update an installment (e.g., mark as paid, update amount)
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const {
            installment_id,
            amount_due,
            amount_paid,
            payment_status,
            paid_date,
            notes
        } = body;

        if (!installment_id) {
            return NextResponse.json({ error: 'installment_id required' }, { status: 400 });
        }

        const updateData: any = {};
        if (amount_due !== undefined) updateData.amount_due = parseFloat(Number(amount_due).toFixed(2));
        if (amount_paid !== undefined) updateData.amount_paid = parseFloat(Number(amount_paid).toFixed(2));
        if (payment_status !== undefined) updateData.payment_status = payment_status;
        if (paid_date !== undefined) updateData.paid_date = paid_date;
        if (notes !== undefined) updateData.notes = notes;

        await FinancingInstallmentsAdapter.update(installment_id, updateData);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update installment:', error);
        return NextResponse.json({ error: 'Failed to update installment' }, { status: 500 });
    }
}

// DELETE - Delete all installments for a financing plan
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const financingId = searchParams.get('financing_id');

        if (!financingId) {
            return NextResponse.json({ error: 'financing_id required' }, { status: 400 });
        }

        await FinancingInstallmentsAdapter.deleteByFinancingId(parseInt(financingId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete installments:', error);
        return NextResponse.json({ error: 'Failed to delete installments' }, { status: 500 });
    }
}
