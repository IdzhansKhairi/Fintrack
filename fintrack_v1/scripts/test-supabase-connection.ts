import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local file explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Debug: Check if environment variables are loaded
console.log('Environment check:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Loaded' : '✗ Missing');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Loaded' : '✗ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Loaded' : '✗ Missing');
console.log('');

// Create Supabase client directly here (after env is loaded)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Make sure .env.local has:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
})

async function testConnection() {
  try {
    console.log('🔍 Testing Supabase connection...\n')

    // Test 1: Count users
    const { data: users, error: usersError, count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact' })

    if (usersError) throw usersError
    console.log(`✅ Users table: ${users?.length || 0} records`)

    // Test 2: Count transactions
    const { data: transactions, error: transError, count: transCount } = await supabase
      .from('transaction_list_table')
      .select('*', { count: 'exact' })

    if (transError) throw transError
    console.log(`✅ Transactions table: ${transactions?.length || 0} records`)

    // Test 3: Count accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('account_balance_table')
      .select('*', { count: 'exact' })

    if (accountsError) throw accountsError
    console.log(`✅ Accounts table: ${accounts?.length || 0} records`)

    // Test 4: Count commitments
    const { data: commitments, error: commitmentsError } = await supabase
      .from('commitment_list_table')
      .select('*', { count: 'exact' })

    if (commitmentsError) throw commitmentsError
    console.log(`✅ Commitments table: ${commitments?.length || 0} records`)

    // Test 5: Count commitment payments
    const { data: payments, error: paymentsError } = await supabase
      .from('commitment_payment_status_table')
      .select('*', { count: 'exact' })

    if (paymentsError) throw paymentsError
    console.log(`✅ Commitment payments table: ${payments?.length || 0} records`)

    // Test 6: Count wishlist
    const { data: wishlist, error: wishlistError } = await supabase
      .from('wishlist_table')
      .select('*', { count: 'exact' })

    if (wishlistError) throw wishlistError
    console.log(`✅ Wishlist table: ${wishlist?.length || 0} records`)

    // Test 7: Count debts
    const { data: debts, error: debtsError } = await supabase
      .from('debts_table')
      .select('*', { count: 'exact' })

    if (debtsError) throw debtsError
    console.log(`✅ Debts table: ${debts?.length || 0} records`)

    // Test 8: Count sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact' })

    if (sessionsError) throw sessionsError
    console.log(`✅ Sessions table: ${sessions?.length || 0} records`)

    console.log('\n🎉 All tests passed! Supabase is connected and data is migrated.')
    console.log('\n📊 Summary:')
    console.log(`   - Users: ${users?.length || 0}`)
    console.log(`   - Transactions: ${transactions?.length || 0}`)
    console.log(`   - Accounts: ${accounts?.length || 0}`)
    console.log(`   - Commitments: ${commitments?.length || 0}`)
    console.log(`   - Commitment Payments: ${payments?.length || 0}`)
    console.log(`   - Wishlist: ${wishlist?.length || 0}`)
    console.log(`   - Debts: ${debts?.length || 0}`)
    console.log(`   - Sessions: ${sessions?.length || 0}`)

  } catch (error: any) {
    console.error('\n❌ Connection test failed!')
    console.error('Error:', error.message)
    if (error.details) {
      console.error('Details:', error.details)
    }
    if (error.hint) {
      console.error('Hint:', error.hint)
    }
    process.exit(1)
  }
}

testConnection()
