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
      console.log('Data already exists, skipping seed')
      return
    }

    // Insert departments
    const { error: deptError } = await supabase
      .from('departments')
      .insert([
        { id: '4242abf4-e68e-48c8-9eaf-ada2612bd412', name: 'Consultation', description: 'General consultation services' },
        { id: '5353bcf5-f79f-59d9-afbf-beb3723ce523', name: 'Laboratory', description: 'Laboratory testing and analysis' },
        { id: '6464cdf6-g8ag-6ae0-bgcg-cfc4834df634', name: 'Ultrasound', description: 'Ultrasound imaging services' },
        { id: '7575def7-h9bh-7bf1-chch-dfd5945eg745', name: 'X-Ray', description: 'X-ray imaging services' },
        { id: '8686efg8-i0ci-8cg2-didi-ege6056fh856', name: 'Pharmacy', description: 'Pharmaceutical services' }
      ])

    if (deptError) {
      console.error('Error inserting departments:', deptError)
    } else {
      console.log('Departments inserted successfully')
    }

    // Insert insurance providers
    const { error: insuranceError } = await supabase
      .from('insurance_providers')
      .insert([
        { id: '1111aaa1-j1dj-9dh3-ejej-fgf7167gi967', name: 'CIC Insurance', contact_info: { phone: '+211-912-345-678', email: 'contact@cic.ss' } },
        { id: '2222bbb2-k2ek-0ei4-fkfk-ghg8278hj078', name: 'UAP Insurance', contact_info: { phone: '+211-912-345-679', email: 'contact@uap.ss' } },
        { id: '3333ccc3-l3fl-1fj5-glgl-hih9389ik189', name: 'CIGNA', contact_info: { phone: '+211-912-345-680', email: 'contact@cigna.ss' } }
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
          amount_ssp: '15000.00',
          amount_usd: '11.54',
          description: 'Consultation fee',
          department_id: '4242abf4-e68e-48c8-9eaf-ada2612bd412',
          insurance_provider_id: '1111aaa1-j1dj-9dh3-ejej-fgf7167gi967',
          patient_name: 'John Doe',
          receipt_number: 'RCT001',
          payment_method: 'insurance',
          created_by: userId,
          created_at: '2025-08-15T10:30:00Z'
        },
        {
          type: 'income',
          amount_ssp: '25000.00',
          amount_usd: '19.23',
          description: 'Laboratory tests',
          department_id: '5353bcf5-f79f-59d9-afbf-beb3723ce523',
          insurance_provider_id: '2222bbb2-k2ek-0ei4-fkfk-ghg8278hj078',
          patient_name: 'Jane Smith',
          receipt_number: 'RCT002',
          payment_method: 'insurance',
          created_by: userId,
          created_at: '2025-08-15T14:15:00Z'
        },
        {
          type: 'income',
          amount_ssp: '35000.00',
          amount_usd: '26.92',
          description: 'Ultrasound scan',
          department_id: '6464cdf6-g8ag-6ae0-bgcg-cfc4834df634',
          patient_name: 'Ahmed Hassan',
          receipt_number: 'RCT003',
          payment_method: 'cash',
          created_by: userId,
          created_at: '2025-08-16T09:00:00Z'
        },
        {
          type: 'income',
          amount_ssp: '20000.00',
          amount_usd: '15.38',
          description: 'X-ray imaging',
          department_id: '7575def7-h9bh-7bf1-chch-dfd5945eg745',
          insurance_provider_id: '3333ccc3-l3fl-1fj5-glgl-hih9389ik189',
          patient_name: 'Sarah Wilson',
          receipt_number: 'RCT004',
          payment_method: 'insurance',
          created_by: userId,
          created_at: '2025-08-16T11:45:00Z'
        },
        {
          type: 'income',
          amount_ssp: '12000.00',
          amount_usd: '9.23',
          description: 'Medication',
          department_id: '8686efg8-i0ci-8cg2-didi-ege6056fh856',
          patient_name: 'Mohammed Ali',
          receipt_number: 'RCT005',
          payment_method: 'cash',
          created_by: userId,
          created_at: '2025-08-17T16:20:00Z'
        },
        {
          type: 'expense',
          amount_ssp: '5000.00',
          amount_usd: '3.85',
          description: 'Medical supplies',
          department_id: '8686efg8-i0ci-8cg2-didi-ege6056fh856',
          receipt_number: 'EXP001',
          payment_method: 'bank_transfer',
          created_by: userId,
          created_at: '2025-08-17T08:30:00Z'
        },
        {
          type: 'expense',
          amount_ssp: '8000.00',
          amount_usd: '6.15',
          description: 'Equipment maintenance',
          department_id: '6464cdf6-g8ag-6ae0-bgcg-cfc4834df634',
          receipt_number: 'EXP002',
          payment_method: 'check',
          created_by: userId,
          created_at: '2025-08-18T12:00:00Z'
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