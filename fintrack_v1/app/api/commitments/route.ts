import { NextResponse } from "next/server";
import { CommitmentsAdapter } from "@/lib/db-adapter";

// GET - Fetch all commitments or filter by status
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        // Use CommitmentsAdapter to support dual database strategy
        const commitments = await CommitmentsAdapter.getAll(status);

        return NextResponse.json(commitments);
    } catch (error) {
        console.error('Failed to fetch commitments:', error);
        return NextResponse.json({ error: 'Failed to fetch commitments' }, { status: 500 });
    }
}

// POST - Create a new commitment
export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            commitment_name,
            commitment_description,
            commitment_per_month,
            commitment_per_year,
            commitment_notes,
            commitment_status,
            commitment_start_month,
            commitment_start_year
        } = body;

        // Ensure the amounts are always stored with 2 decimal places
        const roundedPerMonth = parseFloat(Number(commitment_per_month).toFixed(2));
        const roundedPerYear = parseFloat(Number(commitment_per_year).toFixed(2));

        // Use CommitmentsAdapter to support dual database strategy
        const newCommitment = await CommitmentsAdapter.create({
            commitment_name,
            commitment_description: commitment_description || null,
            commitment_per_month: roundedPerMonth,
            commitment_per_year: roundedPerYear,
            commitment_notes: commitment_notes || null,
            commitment_status: commitment_status || 'Active',
            commitment_start_month: commitment_start_month || null,
            commitment_start_year: commitment_start_year || null
        });

        return NextResponse.json({
            success: true,
            commitment_id: newCommitment.commitment_id
        });
    } catch (error) {
        console.error('Failed to create commitment:', error);
        return NextResponse.json({ error: 'Failed to create commitment' }, { status: 500 });
    }
}

// PUT - Update an existing commitment
export async function PUT(request: Request) {
    try {
        const body = await request.json();

        const {
            commitment_id,
            commitment_name,
            commitment_description,
            commitment_per_month,
            commitment_per_year,
            commitment_notes,
            commitment_status,
            commitment_start_month,
            commitment_start_year
        } = body;

        // Ensure the amounts are always stored with 2 decimal places
        const roundedPerMonth = parseFloat(Number(commitment_per_month).toFixed(2));
        const roundedPerYear = parseFloat(Number(commitment_per_year).toFixed(2));

        // Use CommitmentsAdapter to support dual database strategy
        await CommitmentsAdapter.update(commitment_id, {
            commitment_name,
            commitment_description: commitment_description || null,
            commitment_per_month: roundedPerMonth,
            commitment_per_year: roundedPerYear,
            commitment_notes: commitment_notes || null,
            commitment_status,
            commitment_start_month: commitment_start_month || null,
            commitment_start_year: commitment_start_year || null
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update commitment:', error);
        return NextResponse.json({ error: 'Failed to update commitment' }, { status: 500 });
    }
}

// DELETE - Delete a commitment
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const commitment_id = searchParams.get('id');

        if (!commitment_id) {
            return NextResponse.json({ error: 'Commitment ID required' }, { status: 400 });
        }

        // Use CommitmentsAdapter to support dual database strategy
        await CommitmentsAdapter.delete(parseInt(commitment_id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete commitment:', error);
        return NextResponse.json({ error: 'Failed to delete commitment' }, { status: 500 });
    }
}
