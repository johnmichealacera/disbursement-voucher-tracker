import { PrismaClient, UserRole, VoucherStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create users with different roles
  const users = [
    {
      name: 'System Administrator',
      email: 'admin@municipality.gov',
      password: await bcrypt.hash('admin123', 12),
      role: 'ADMIN' as UserRole,
      department: 'IT Department'
    },
    {
      name: 'John Requester',
      email: 'requester@municipality.gov',
      password: await bcrypt.hash('requester123', 12),
      role: 'REQUESTER' as UserRole,
      department: 'Public Works'
    },
    {
      name: 'Jane Accountant',
      email: 'accounting@municipality.gov',
      password: await bcrypt.hash('accounting123', 12),
      role: 'ACCOUNTING' as UserRole,
      department: 'Finance Department'
    },
    {
      name: 'Bob Budget',
      email: 'budget@municipality.gov',
      password: await bcrypt.hash('budget123', 12),
      role: 'BUDGET' as UserRole,
      department: 'Finance Department'
    },
    {
      name: 'Alice Treasury',
      email: 'treasury@municipality.gov',
      password: await bcrypt.hash('treasury123', 12),
      role: 'TREASURY' as UserRole,
      department: 'Treasury Department'
    },
    {
      name: 'Secretary Officer',
      email: 'secretary@municipality.gov',
      password: await bcrypt.hash('secretary123', 12),
      role: 'SECRETARY' as UserRole,
      department: 'Executive Office'
    },
    {
      name: 'Department Head',
      email: 'depthead@municipality.gov',
      password: await bcrypt.hash('depthead123', 12),
      role: 'DEPARTMENT_HEAD' as UserRole,
      department: 'Public Works'
    },
    {
      name: 'Finance Head',
      email: 'finhead@municipality.gov',
      password: await bcrypt.hash('finhead123', 12),
      role: 'FINANCE_HEAD' as UserRole,
      department: 'Finance Department'
    },
    {
      name: 'GSO Officer',
      email: 'gso@municipality.gov',
      password: await bcrypt.hash('gso123', 12),
      role: 'GSO' as UserRole,
      department: 'General Services Office'
    },
    {
      name: 'HR Officer',
      email: 'hr@municipality.gov',
      password: await bcrypt.hash('hr123', 12),
      role: 'HR' as UserRole,
      department: 'Human Resources'
    },
    {
      name: 'BAC Member 1',
      email: 'bac1@municipality.gov',
      password: await bcrypt.hash('bac123', 12),
      role: 'BAC' as UserRole,
      department: 'Bids and Awards Committee'
    },
    {
      name: 'BAC Member 2',
      email: 'bac2@municipality.gov',
      password: await bcrypt.hash('bac123', 12),
      role: 'BAC' as UserRole,
      department: 'Bids and Awards Committee'
    },
    {
      name: 'BAC Member 3',
      email: 'bac3@municipality.gov',
      password: await bcrypt.hash('bac123', 12),
      role: 'BAC' as UserRole,
      department: 'Bids and Awards Committee'
    },
    {
      name: 'BAC Member 4',
      email: 'bac4@municipality.gov',
      password: await bcrypt.hash('bac123', 12),
      role: 'BAC' as UserRole,
      department: 'Bids and Awards Committee'
    },
    {
      name: 'BAC Member 5',
      email: 'bac5@municipality.gov',
      password: await bcrypt.hash('bac123', 12),
      role: 'BAC' as UserRole,
      department: 'Bids and Awards Committee'
    }
  ]

  console.log('👥 Creating users...')
  const createdUsers = []
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: userData
    })
    createdUsers.push(user)
    console.log(`✅ Created user: ${user.name} (${user.role})`)
  }

  // Find specific users for creating sample data
  const requester = createdUsers.find(u => u.role === 'REQUESTER')

  if (requester) {
    console.log('📄 Creating sample disbursement vouchers...')
    
    // Create sample disbursement vouchers
    const sampleVouchers = [
      {
        payee: 'ABC Office Supplies Inc.',
        address: '123 Business District, Quezon City',
        amount: 15000.00,
        particulars: 'Office Operations Q1 2024 - Essential supplies for daily operations',
        tags: ['office-supplies', 'stationery', 'Q1-2024'],
        sourceOffice: ['General Services Office', 'Administrative Office'],
        status: VoucherStatus.DRAFT,
        createdById: requester.id,
        items: [
          {
            description: 'A4 Paper (500 sheets)',
            quantity: 20,
            unit: 'ream',
            unitPrice: 250.00,
            totalPrice: 5000.00
          },
          {
            description: 'Ballpoint Pens (Box of 12)',
            quantity: 10,
            unit: 'box',
            unitPrice: 300.00,
            totalPrice: 3000.00
          },
          {
            description: 'Manila Folders',
            quantity: 100,
            unit: 'piece',
            unitPrice: 70.00,
            totalPrice: 7000.00
          }
        ]
      },
      {
        payee: 'XYZ Construction Supply Co.',
        address: '456 Industrial Avenue, Makati City',
        amount: 250000.00,
        particulars: 'Infrastructure Maintenance 2024 - Road repair materials and equipment',
        tags: ['infrastructure', 'road-maintenance', 'construction'],
        sourceOffice: ['Engineering Office', 'Public Works Department'],
        status: VoucherStatus.PENDING,
        createdById: requester.id,
        items: [
          {
            description: 'Asphalt Mix (per ton)',
            quantity: 50,
            unit: 'ton',
            unitPrice: 3500.00,
            totalPrice: 175000.00
          },
          {
            description: 'Road Marking Paint (per gallon)',
            quantity: 25,
            unit: 'gallon',
            unitPrice: 1200.00,
            totalPrice: 30000.00
          },
          {
            description: 'Traffic Cones',
            quantity: 50,
            unit: 'piece',
            unitPrice: 900.00,
            totalPrice: 45000.00
          }
        ]
      },
      {
        payee: 'Festival Events & Supplies',
        address: '789 Event Plaza, Pasig City',
        amount: 75000.00,
        particulars: 'Community Festival 2024 - Event equipment and decorative materials',
        tags: ['community-event', 'festival', 'entertainment'],
        sourceOffice: ['Community Affairs Office', 'Cultural Office'],
        status: VoucherStatus.VALIDATED,
        createdById: requester.id,
        items: [
          {
            description: 'Event Tents (10x10)',
            quantity: 10,
            unit: 'piece',
            unitPrice: 5000.00,
            totalPrice: 50000.00
          },
          {
            description: 'Sound System Rental',
            quantity: 1,
            unit: 'set',
            unitPrice: 15000.00,
            totalPrice: 15000.00
          },
          {
            description: 'Decorative Materials',
            quantity: 1,
            unit: 'lot',
            unitPrice: 10000.00,
            totalPrice: 10000.00
          }
        ]
      }
    ]

    for (const voucherData of sampleVouchers) {
      const { items, ...voucherInfo } = voucherData
      const voucher = await prisma.disbursementVoucher.create({
        data: {
          payee: voucherInfo.payee,
          address: voucherInfo.address,
          amount: voucherInfo.amount,
          particulars: voucherInfo.particulars,
          tags: voucherInfo.tags,
          sourceOffice: voucherInfo.sourceOffice,
          status: voucherInfo.status,
          createdById: voucherInfo.createdById,
          items: {
            create: items
          }
        }
      })
      console.log(`✅ Created voucher: ${voucher.payee} (${voucher.status})`)

      // Create audit trail for the voucher
      await prisma.auditTrail.create({
        data: {
          action: 'CREATE',
          entityType: 'DisbursementVoucher',
          entityId: voucher.id,
          newValues: voucher,
          userId: requester.id,
          disbursementVoucherId: voucher.id
        }
      })
    }
  }

  console.log('🎉 Database seed completed successfully!')
  console.log('\n📋 Login Credentials:')
  console.log('Admin: admin@municipality.gov / admin123')
  console.log('Requester: requester@municipality.gov / requester123')
  console.log('Accounting: accounting@municipality.gov / accounting123')
  console.log('Budget: budget@municipality.gov / budget123')
  console.log('Treasury: treasury@municipality.gov / treasury123')
  console.log('Secretary: secretary@municipality.gov / secretary123')
  console.log('Mayor: mayor@municipality.gov / mayor123')
  console.log('Dept Head: depthead@municipality.gov / depthead123')
  console.log('Finance Head: finhead@municipality.gov / finhead123')
  console.log('GSO: gso@municipality.gov / gso123')
  console.log('HR: hr@municipality.gov / hr123')
  console.log('BAC Member 1: bac1@municipality.gov / bac123')
  console.log('BAC Member 2: bac2@municipality.gov / bac123')
  console.log('BAC Member 3: bac3@municipality.gov / bac123')
  console.log('BAC Member 4: bac4@municipality.gov / bac123')
  console.log('BAC Member 5: bac5@municipality.gov / bac123')
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
