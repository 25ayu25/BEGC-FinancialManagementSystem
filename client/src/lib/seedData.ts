import { supabase } from './supabase'

export async function seedSupabaseData() {
  try {
    console.log('Starting to seed Supabase data...')

    // Check if data already exists
    const { data: existingDepts } = await supabase
      .from('departments')
      .select('id')
      .limit(1)

    if (existingDepts && existingDepts.length > 0) {
      // Force reseed by clearing first
      console.log('Clearing existing data for fresh seed...')
      await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('insurance_providers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }

    // Insert departments (schema only has id, name, created_at)
    const { error: deptError } = await supabase
      .from('departments')
      .insert([
        { id: '4242abf4-e68e-48c8-9eaf-ada2612bd412', name: 'Consultation' },
        { id: '5353bcf5-f79f-59d9-afbf-beb3723ce523', name: 'Laboratory' },
        { id: '6464cdf6-g8ag-6ae0-bgcg-cfc4834df634', name: 'Ultrasound' },
        { id: '7575def7-h9bh-7bf1-chch-dfd5945eg745', name: 'X-Ray' },
        { id: '8686efg8-i0ci-8cg2-didi-ege6056fh856', name: 'Pharmacy' }
      ])

    if (deptError) {
      console.error('Error inserting departments:', deptError)
    } else {
      console.log('Departments inserted successfully')
    }

    // Insert insurance providers (schema only has id, name, created_at)
    const { error: insuranceError } = await supabase
      .from('insurance_providers')
      .insert([
        { id: '11111111-1111-1111-1111-111111111111', name: 'CIC Insurance' },
        { id: '22222222-2222-2222-2222-222222222222', name: 'UAP Insurance' },
        { id: '33333333-3333-3333-3333-333333333333', name: 'CIGNA' }
      ])

    if (insuranceError) {
      console.error('Error inserting insurance providers:', insuranceError)
    } else {
      console.log('Insurance providers inserted successfully')
    }

    // Get current user for created_by field
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    if (!userId) {
      console.error('No authenticated user found for seeding transactions')
      return
    }

    // Insert sample transactions for August 2025
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert([
        {
          type: 'income',
          amount: 15000.00,
          currency: 'SSP',
          description: 'Consultation fee',
          department_id: '4242abf4-e68e-48c8-9eaf-ada2612bd412',
          insurance_provider_id: '1111aaa1-j1dj-9dh3-ejej-fgf7167gi967',
          date: '2024-08-15',
          created_by: userId,
          created_at: '2024-08-15T10:30:00Z'
        },
        {
          type: 'income',
          amount: 11.54,
          currency: 'USD',
          description: 'Insurance payment for consultation',
          department_id: '4242abf4-e68e-48c8-9eaf-ada2612bd412',
          insurance_provider_id: '1111aaa1-j1dj-9dh3-ejej-fgf7167gi967',
          date: '2024-08-15',
          created_by: userId,
          created_at: '2024-08-15T10:30:00Z'
        },
        {
          type: 'income',
          amount: 25000.00,
          currency: 'SSP',
          description: 'Laboratory tests',
          department_id: '5353bcf5-f79f-59d9-afbf-beb3723ce523',
          insurance_provider_id: '2222bbb2-k2ek-0ei4-fkfk-ghg8278hj078',
          date: '2024-08-15',
          created_by: userId,
          created_at: '2024-08-15T14:15:00Z'
        },
        {
          type: 'income',
          amount: 19.23,
          currency: 'USD',
          description: 'Laboratory tests insurance payment',
          department_id: '5353bcf5-f79f-59d9-afbf-beb3723ce523',
          insurance_provider_id: '2222bbb2-k2ek-0ei4-fkfk-ghg8278hj078',
          date: '2024-08-15',
          created_by: userId,
          created_at: '2024-08-15T14:15:00Z'
        },
        {
          type: 'income',
          amount: 35000.00,
          currency: 'SSP',
          description: 'Ultrasound scan',
          department_id: '6464cdf6-g8ag-6ae0-bgcg-cfc4834df634',
          date: '2024-08-16',
          created_by: userId,
          created_at: '2024-08-16T09:00:00Z'
        },
        {
          type: 'income',
          amount: 20000.00,
          currency: 'SSP',
          description: 'X-ray imaging',
          department_id: '7575def7-h9bh-7bf1-chch-dfd5945eg745',
          insurance_provider_id: '3333ccc3-l3fl-1fj5-glgl-hih9389ik189',
          date: '2024-08-16',
          created_by: userId,
          created_at: '2024-08-16T11:45:00Z'
        },
        {
          type: 'income',
          amount: 15.38,
          currency: 'USD',
          description: 'X-ray insurance payment',
          department_id: '7575def7-h9bh-7bf1-chch-dfd5945eg745',
          insurance_provider_id: '3333ccc3-l3fl-1fj5-glgl-hih9389ik189',
          date: '2024-08-16',
          created_by: userId,
          created_at: '2024-08-16T11:45:00Z'
        },
        {
          type: 'income',
          amount: 12000.00,
          currency: 'SSP',
          description: 'Medication',
          department_id: '8686efg8-i0ci-8cg2-didi-ege6056fh856',
          date: '2024-08-17',
          created_by: userId,
          created_at: '2024-08-17T16:20:00Z'
        },
        {
          type: 'expense',
          amount: 5000.00,
          currency: 'SSP',
          description: 'Medical supplies',
          department_id: '8686efg8-i0ci-8cg2-didi-ege6056fh856',
          date: '2024-08-17',
          created_by: userId,
          created_at: '2024-08-17T08:30:00Z'
        },
        {
          type: 'expense',
          amount: 8000.00,
          currency: 'SSP',
          description: 'Equipment maintenance',
          department_id: '6464cdf6-g8ag-6ae0-bgcg-cfc4834df634',
          date: '2024-08-18',
          created_by: userId,
          created_at: '2024-08-18T12:00:00Z'
        }
      ])

    if (transactionError) {
      console.error('Error inserting transactions:', transactionError)
    } else {
      console.log('Transactions inserted successfully')
    }

    console.log('Supabase data seeding completed!')
    
  } catch (error) {
    console.error('Error seeding data:', error)
  }
}