# Disbursement Tracking System (DTS)

A comprehensive, transparent, and efficient disbursement tracking system designed for municipal government operations. Built with Next.js 14, TypeScript, PostgreSQL, and modern web technologies.

## 🏗️ Architecture

- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with credentials provider
- **UI Components**: ShadCN/UI (Radix UI + Tailwind CSS)
- **Deployment**: Vercel-ready

## 🚀 Features

### Core Functionality
- **Multi-role Authentication**: Supports 8 different user roles with appropriate permissions
- **Disbursement Lifecycle Management**: From draft creation to fund release
- **Multi-level Approval Workflow**: Department Head → Finance Head → Mayor
- **Real-time Status Tracking**: Complete visibility of disbursement progress
- **Comprehensive Audit Trail**: Full transparency with detailed activity logs

### User Roles
- **Requester**: Create and manage disbursement requests
- **Accounting**: Validate and process financial aspects
- **Budget**: Review budget allocations and compliance
- **Treasury**: Handle fund disbursement and payment processing
- **Department Head**: First-level approval authority
- **Finance Head**: Financial oversight and approval
- **Mayor**: Final approval authority
- **Admin**: System administration and user management

### Key Features
- **Dashboard**: Role-based overview with key metrics and recent activities
- **Voucher Management**: Create, edit, and track disbursement vouchers with full timestamps
- **Item-based Requests**: Detailed line items with automatic calculations
- **Document Attachments**: Support for supporting documents
- **Approval Workflow**: Structured multi-level approval process with role-based buttons
- **Status Management**: Clear status progression (Draft → Pending → Validated → Approved → Released)
- **Real-time Notifications**: Smart notification system with role-based alerts
- **Enhanced Audit Trail**: Complete history with detailed timestamps and action descriptions
- **User Management**: Complete admin interface for user administration
- **Responsive Design**: Mobile-friendly interface with modern UI components

## 🛠️ Tech Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **ShadCN/UI**: Modern component library
- **React Hook Form**: Form management with validation
- **Zod**: Schema validation

### Backend
- **Next.js API Routes**: Serverless API endpoints
- **Prisma ORM**: Type-safe database access
- **PostgreSQL**: Robust relational database
- **NextAuth.js**: Authentication and session management
- **bcryptjs**: Password hashing

### Development Tools
- **ESLint**: Code linting
- **TypeScript**: Static type checking
- **Prisma Studio**: Database management GUI

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd disbursement-voucher-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/disbursement_tracker"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here"
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Seed database with sample data
   npm run db:seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Access the Application**
   - Open http://localhost:3000
   - Use the seeded credentials to login (see below)

## 👥 Default User Accounts

The seed script creates the following test accounts:

| Role | Email | Password | Department |
|------|-------|----------|------------|
| Admin | admin@municipality.gov | admin123 | IT Department |
| Requester | requester@municipality.gov | requester123 | Public Works |
| Accounting | accounting@municipality.gov | accounting123 | Finance Department |
| Budget | budget@municipality.gov | budget123 | Finance Department |
| Treasury | treasury@municipality.gov | treasury123 | Treasury Department |
| Mayor | mayor@municipality.gov | mayor123 | Executive Office |
| Department Head | depthead@municipality.gov | depthead123 | Public Works |
| Finance Head | finhead@municipality.gov | finhead123 | Finance Department |

## 🗂️ Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth.js configuration
│   │   ├── disbursements/ # Disbursement CRUD operations
│   │   └── users/         # User management
│   ├── dashboard/         # Dashboard page
│   ├── disbursements/     # Disbursement listing and details
│   ├── create/            # Create new disbursement
│   ├── login/             # Authentication page
│   └── layout.tsx         # Root layout
├── components/            # Reusable UI components
│   ├── layout/            # Layout components
│   └── ui/                # ShadCN/UI components
├── lib/                   # Utility functions and configurations
│   ├── auth.ts            # NextAuth.js configuration
│   ├── prisma.ts          # Prisma client
│   └── utils.ts           # Helper functions
└── middleware.ts          # Route protection middleware

prisma/
├── schema.prisma          # Database schema
└── seed.ts               # Database seeding script
```

## 🔄 Workflow Process

### 1. Initiation (Requester)
- Create disbursement voucher with detailed items
- Add supporting documents
- Submit for validation (triggers notifications)

### 2. Validation (Accounting/Finance)
- Receive real-time notification of pending vouchers
- Review completeness and budget allocation
- Use "Validate" button for approval or "Reject" with remarks
- System automatically updates status and notifies next level

### 3. Multi-Level Approval Workflow
- **Level 1**: Department Head receives notification → "Validate" button → Status: VALIDATED
- **Level 2**: Finance Head receives notification → "Approve" button → Status: APPROVED  
- **Level 3**: Mayor receives notification → "Final Approve" button → Status: RELEASED
- **Sequential enforcement**: Each level must be completed before the next

### 4. Disbursement Processing (Treasury)
- Receive notification when voucher is fully approved
- Prepare disbursement voucher
- Validate compliance
- Process payment and mark as "Released"

### 5. Status Notifications
- **Requesters**: Get notified of status changes (validated, approved, released, rejected)
- **Approvers**: Get notified of pending items requiring their action
- **Treasury**: Get notified of approved vouchers ready for disbursement
- **Admin**: Get overview of all pending items across all levels

## 🔐 Security Features

- **Role-based Access Control**: Granular permissions per user role
- **Route Protection**: Middleware-based authentication
- **Password Security**: bcrypt hashing with salt rounds
- **Session Management**: Secure JWT-based sessions
- **Audit Trail**: Complete activity logging
- **Input Validation**: Zod schema validation on all inputs

## 📊 Database Schema

### Core Entities
- **User**: System users with roles and departments
- **DisbursementVoucher**: Main disbursement requests
- **DisbursementItem**: Line items within vouchers
- **Attachment**: Supporting documents
- **Approval**: Multi-level approval records
- **AuditTrail**: Complete activity history

### Key Relationships
- Users can create multiple disbursement vouchers
- Vouchers contain multiple items and attachments
- Approval workflow tracks multi-level approvals
- Audit trail maintains complete transparency

## 🚀 Deployment

### Vercel Deployment
1. Connect your repository to Vercel
2. Configure environment variables
3. Deploy with automatic builds

### Database Hosting
- **Recommended**: Vercel Postgres, Supabase, or PlanetScale
- **Self-hosted**: PostgreSQL on VPS or cloud provider

### Environment Variables for Production
```env
DATABASE_URL="your-production-database-url"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-production-secret"
```

## 🧪 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with sample data
npm run db:reset     # Reset database (development only)
```

### Adding New Features
1. Update Prisma schema if needed
2. Create/update API routes
3. Build UI components
4. Add proper authentication checks
5. Update audit trail logging

## 🔔 Notification System

### Real-time Notifications
The system features a comprehensive notification system that keeps users informed of relevant disbursement activities:

#### **Notification Bell**
- Located in the top-right corner next to the user account
- Shows red badge with count for urgent notifications
- Animated bell and bouncing badge for attention
- Auto-refreshes every 30 seconds

#### **Role-based Notifications**
- **Department Head**: Pending vouchers needing Level 1 validation
- **Finance Head/Accounting**: Validated vouchers needing Level 2 approval
- **Mayor**: Approved vouchers needing final authorization
- **Treasury**: Fully approved vouchers ready for disbursement
- **Requester**: Status updates on their submitted vouchers
- **Admin**: Overview of all pending items across all levels

#### **Smart Features**
- **Priority System**: High (urgent), Medium (normal), Low (informational)
- **Direct Navigation**: Click notification to go directly to voucher
- **Rich Information**: Shows timestamps, user roles, and action context
- **Sequential Awareness**: Only shows actionable items for each role

## 📝 API Documentation

### Authentication
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout

### Disbursements
- `GET /api/disbursements` - List disbursements (with filters)
- `POST /api/disbursements` - Create new disbursement
- `GET /api/disbursements/[id]` - Get disbursement details
- `PATCH /api/disbursements/[id]` - Update disbursement
- `DELETE /api/disbursements/[id]` - Delete disbursement
- `POST /api/disbursements/[id]/submit` - Submit draft for review
- `POST /api/disbursements/[id]/approve` - Approve/reject disbursement

### Users (Admin only)
- `GET /api/users` - List users with filtering and pagination
- `POST /api/users` - Create new user
- `GET /api/users/[id]` - Get user details
- `PATCH /api/users/[id]` - Update user information
- `DELETE /api/users/[id]` - Delete user (with safety checks)

### Notifications
- `GET /api/notifications` - Get role-based notifications for current user

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support or questions:
- Create an issue in the repository
- Contact your system administrator
- Review the documentation

## ✨ Recent Enhancements (v2.0)

### **🔔 Real-time Notification System**
- Smart role-based notifications with priority levels
- Visual notification bell with animated indicators
- Auto-refresh every 30 seconds for real-time updates
- Direct navigation from notifications to relevant vouchers

### **⚡ Enhanced Approval Workflow**
- Role-specific action buttons (Validate, Approve, Final Approve, Reject)
- Sequential approval enforcement with smart logic
- Admin can approve at any level with automatic level detection
- Real-time status updates after approval actions

### **📊 Improved Activity Tracking**
- Full timestamps instead of just dates in activity logs
- Color-coded activity indicators by action type
- Enhanced action descriptions with user role context
- Expanded activity history (10 items vs 5)

### **👥 Complete User Management**
- Full admin interface for user administration
- Advanced filtering and search capabilities
- User creation, editing, and status management
- Safety checks preventing self-deletion and data integrity issues

### **🎨 UI/UX Improvements**
- Modern notification dropdown with rich information display
- Enhanced disbursement detail page with approval buttons
- Improved activity log with better visual hierarchy
- Responsive design optimizations

## 🔮 Future Enhancements

- **Email Notifications**: Automated status change notifications
- **File Upload**: Document attachment functionality
- **Reporting**: Advanced analytics and reporting
- **Mobile App**: Native mobile application
- **Integration**: ERP system integration
- **Workflow Customization**: Configurable approval workflows