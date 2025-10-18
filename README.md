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
- **Multi-role Authentication**: Supports 11 different user roles with appropriate permissions
- **Disbursement Lifecycle Management**: From draft creation to fund release
- **Multi-level Approval Workflow**: Department Head → Finance Head → Mayor
- **GSO Specialized Workflow**: Mayor → BAC → Budget → Accounting → Treasury review chain
- **Real-time Status Tracking**: Complete visibility of disbursement progress
- **Comprehensive Audit Trail**: Full transparency with detailed activity logs and timestamps

### User Roles
- **Requester**: Create and manage disbursement requests
- **GSO (General Services Office)**: Create and manage procurement-related disbursement requests
- **HR (Human Resources)**: Create and manage HR-related disbursement requests
- **Accounting**: Validate and process financial aspects, review GSO workflow vouchers
- **Budget**: Review budget allocations and compliance, review GSO workflow vouchers
- **Treasury**: Handle fund disbursement and payment processing, final review for GSO workflow
- **Department Head**: First-level approval authority
- **Finance Head**: Financial oversight and approval
- **Mayor**: Review vouchers from GSO, HR, and regular offices
- **BAC (Bids and Awards Committee)**: Review GSO vouchers after Mayor approval
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
- **Philippine Peso Support**: All currency displays use Philippine Peso (₱) formatting

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
| GSO | gso@municipality.gov | gso123 | General Services Office |
| HR | hr@municipality.gov | hr123 | Human Resources |
| BAC | bac@municipality.gov | bac123 | Bids and Awards Committee |
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
- `POST /api/disbursements/[id]/review` - Mayor review for GSO/HR/Requester vouchers
- `POST /api/disbursements/[id]/bac-review` - BAC review for GSO vouchers
- `POST /api/disbursements/[id]/budget-review` - Budget Office review for GSO vouchers
- `POST /api/disbursements/[id]/accounting-review` - Accounting review for GSO vouchers
- `POST /api/disbursements/[id]/treasury-review` - Treasury review for GSO vouchers

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

## ✨ Recent Enhancements (v3.0)

### **🏢 New Organizational Roles**
- **GSO (General Services Office)**: Specialized procurement workflow management
- **HR (Human Resources)**: HR-specific disbursement request handling
- **BAC (Bids and Awards Committee)**: Review GSO procurement requests

### **🔄 GSO Specialized Workflow**
- **Sequential Review Chain**: Mayor → BAC → Budget → Accounting → Treasury
- **Smart Button States**: Visual indicators for workflow progression
- **Role-based Notifications**: Each department gets notified when their review is needed
- **Complete Audit Trail**: Full tracking of all review steps with timestamps

### **🔔 Enhanced Notification System**
- **Role-specific Alerts**: Tailored notifications for each workflow participant
- **Priority-based Messaging**: High priority for urgent reviews, medium for status updates
- **Smart Filtering**: Only shows actionable items for each role
- **Real-time Updates**: Auto-refresh every 30 seconds with visual indicators

### **⚡ Advanced Approval Logic**
- **Sequential Enforcement**: Each step must be completed before the next
- **Visual State Management**: Buttons show "Awaiting Previous Review" when dependencies aren't met
- **Multi-workflow Support**: Regular approval workflow + GSO specialized workflow
- **Admin Flexibility**: Admins can act at appropriate levels in both workflows

### **📊 Comprehensive Activity Tracking**
- **Full Timestamp Logging**: Complete date and time for all actions
- **Role-specific Descriptions**: Clear action descriptions with department context
- **Color-coded Indicators**: Visual differentiation for different action types
- **Extended History**: Detailed audit trail for compliance and transparency

### **👥 Complete User Management System**
- **11 User Roles**: Full support for all organizational roles
- **Advanced Admin Interface**: User creation, editing, and management
- **Role-based Permissions**: Granular access control for each role type
- **Department Management**: Proper organizational structure support

### **🎨 Enhanced User Experience**
- **Smart Review Buttons**: Context-aware buttons with tooltips and state indicators
- **Visual Workflow Progress**: Clear indication of where each voucher stands
- **Responsive Design**: Optimized for all device types
- **Intuitive Navigation**: Easy access to relevant functions for each role

## 🐛 Recent Bug Fixes (v3.1)

### **🔧 Critical Fixes**
- **Fixed Prisma Validation Error**: Resolved conflicting `include`/`select` clauses in notifications API causing 500 errors for Mayor role
- **Corrected Property References**: Fixed notification messages using correct `payee` property instead of non-existent `title` property
- **TypeScript Form Schema Fix**: Resolved type mismatch in create voucher form for `tags` and `sourceOffice` array fields
- **Code Quality Improvements**: Cleaned up unused imports and parameters to eliminate linting warnings

### **🎯 Impact**
- **Mayor Dashboard**: Now loads without errors and displays proper notifications
- **Form Creation**: Disbursement voucher creation form works without TypeScript compilation errors
- **Notification System**: All role-based notifications display correctly with proper voucher information
- **Developer Experience**: Clean codebase with no linting warnings or errors

## ✨ Latest Updates (v3.2)

### **🏦 Enhanced Treasury Workflow**
- **Check Number Issuance**: Treasury can now issue specific check numbers for approved disbursements
- **Release Management**: Three-step Treasury process: Check Issuance → Available for Release → Released
- **Check Number Tracking**: Full audit trail of check numbers issued and release dates
- **Input Validation**: Required check number field with proper validation before issuance

### **📊 Advanced Progress Tracking**
- **Real-time Progress Bar**: Visual progress indicator showing completion percentage toward Treasury approval
- **Workflow-specific Progress**: Different progress calculations for Standard, GSO, and HR workflows
- **Reactive Updates**: Progress bar updates instantly when review buttons are clicked
- **Smart State Detection**: Accurate progress calculation based on audit trail actions

### **🔔 Comprehensive Workflow Notifications**
- **Multi-department Notifications**: All departments in the workflow receive notifications when reviews are completed
- **Smart Department Detection**: Automatically identifies relevant departments based on workflow type
- **Contextual Messages**: Detailed notification messages with action context and financial details
- **Priority-based System**: High priority for rejections/releases, medium for approvals, low for submissions

### **📋 Enhanced Activity Log**
- **Check Details Display**: Shows specific check numbers issued by Treasury
- **Release Information**: Displays release dates and Treasury comments
- **Visual Indicators**: Color-coded action types with emerald for check issuance and green for releases
- **Detailed Information Cards**: Rich context for Treasury actions with check numbers and comments

### **🎯 Improved Dashboard & List Views**
- **Comprehensive Information Display**: Shows payee, particulars, department, and amount in dashboard
- **Better Information Hierarchy**: Most important details displayed prominently
- **Enhanced List View**: Reorganized columns with particulars and department information
- **Consistent Experience**: Uniform information display across all views

### **🔧 Technical Improvements**
- **Type Safety**: Enhanced TypeScript interfaces for better type checking
- **API Integration**: Updated all review endpoints to send workflow notifications
- **Error Handling**: Improved error handling and validation across all components
- **Code Quality**: Cleaned up unused imports and improved code organization

## 🐛 Critical Bug Fixes (v3.3)

### **🔧 Workflow Logic Fixes**
- **Fixed GSO vs Standard Workflow Approval Levels**: Corrected hardcoded approval level checks that were causing incorrect button states and progress calculations
- **Budget Review Logic**: Fixed budget review button showing "already reviewed" when it wasn't actually reviewed in GSO workflows
- **Accounting Review Logic**: Fixed accounting review button logic to check correct approval levels based on workflow type
- **Treasury Review Logic**: Fixed treasury action buttons to wait for correct accounting approval levels

### **⚡ Data Loading Race Condition Fixes**
- **Eliminated Runtime Errors**: Fixed "Cannot read properties of undefined" errors by implementing proper data validation
- **Progress Bar Accuracy**: Fixed progress bar showing incorrect states due to incomplete data loading
- **Component Rendering**: Added comprehensive data completeness validation before rendering main component
- **Loading State Management**: Improved loading state handling to prevent premature rendering

### **🛡️ Robust Data Validation**
- **Complete Data Check**: Added `isDisbursementDataComplete()` function to validate all required data before rendering
- **Workflow-Specific Validation**: Ensures GSO workflows have `bacReviews` data loaded before rendering
- **Array Validation**: Validates `approvals`, `auditTrails`, and other critical arrays are present
- **Type Safety**: Enhanced TypeScript typing for better error prevention

### **🎯 Impact**
- **Treasury View**: Treasury users now see accurate progress states and correct workflow progression
- **GSO Workflow**: BAC reviews, Budget, and Accounting steps now display correct completion status
- **Standard Workflow**: All approval levels show accurate states without race conditions
- **User Experience**: No more incorrect "already reviewed" messages or wrong progress percentages
- **Reliability**: Components render consistently on first load without requiring page refreshes

### **🔧 Technical Details**
- **Approval Level Mapping**: Fixed GSO workflow to use correct levels (Budget=3, Accounting=4, Treasury=5)
- **Data Loading**: Modified `fetchDisbursement()` to only set loading=false when data is complete
- **Null Safety**: Replaced band-aid optional chaining with proper data validation
- **Progress Calculation**: Fixed `progress-utils.ts` to handle GSO workflow approval sequences correctly
- **Currency Localization**: Updated all currency displays to use Philippine Peso (₱) instead of dollar signs

## 🔮 Future Enhancements

- **Email Notifications**: Automated status change notifications
- **File Upload**: Document attachment functionality
- **Reporting**: Advanced analytics and reporting
- **Mobile App**: Native mobile application
- **Integration**: ERP system integration
- **Workflow Customization**: Configurable approval workflows