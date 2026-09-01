import { NextResponse } from "next/server";
import { FinancingInstallmentsAdapter } from "@/lib/db-adapter";

// GET - Fetch financing installment amounts for commitments linked to financing plans
// Used by the Commitment Status page to display dynamic per-month amounts
// Query params: month (0-indexed), year
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        if (month === null || year === null) {
            return NextResponse.json(
                { error: 'Both month and year parameters are required' },
                { status: 400 }
            );
        }

        const linkedAmounts = await FinancingInstallmentsAdapter.getLinkedCommitmentAmounts(
            parseInt(month),
            parseInt(year)
        );

        return NextResponse.json(linkedAmounts);
    } catch (error) {
        console.error('Failed to fetch linked commitment amounts:', error);
        return NextResponse.json(
            { error: 'Failed to fetch linked commitment amounts' },
            { status: 500 }
        );
    }
}
