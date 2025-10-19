-- Database Performance Optimization Indexes
-- Run these SQL commands to improve query performance

-- Indexes for DisbursementVoucher table
-- Status filtering (most common query)
CREATE INDEX IF NOT EXISTS idx_disbursement_status ON disbursement_vouchers(status);

-- Created by filtering (role-based access)
CREATE INDEX IF NOT EXISTS idx_disbursement_created_by ON disbursement_vouchers(created_by_id);

-- Date range filtering
CREATE INDEX IF NOT EXISTS idx_disbursement_created_at ON disbursement_vouchers(created_at);

-- Amount range filtering
CREATE INDEX IF NOT EXISTS idx_disbursement_amount ON disbursement_vouchers(amount);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_disbursement_status_created_at ON disbursement_vouchers(status, created_at);
CREATE INDEX IF NOT EXISTS idx_disbursement_created_by_status ON disbursement_vouchers(created_by_id, status);

-- Text search indexes (for payee, particulars)
-- Note: These are PostgreSQL specific. For MySQL, use FULLTEXT indexes instead
CREATE INDEX IF NOT EXISTS idx_disbursement_payee_gin ON disbursement_vouchers USING gin(to_tsvector('english', payee));
CREATE INDEX IF NOT EXISTS idx_disbursement_particulars_gin ON disbursement_vouchers USING gin(to_tsvector('english', particulars));

-- Indexes for User table
CREATE INDEX IF NOT EXISTS idx_user_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_user_is_active ON users(is_active);

-- Indexes for Approval table
CREATE INDEX IF NOT EXISTS idx_approval_disbursement_id ON approvals(disbursement_voucher_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approval_level ON approvals(level);

-- Indexes for BAC Reviews
CREATE INDEX IF NOT EXISTS idx_bac_review_disbursement_id ON bac_reviews(disbursement_voucher_id);
CREATE INDEX IF NOT EXISTS idx_bac_review_status ON bac_reviews(status);

-- Indexes for Audit Trails
CREATE INDEX IF NOT EXISTS idx_audit_trail_disbursement_id ON audit_trails(disbursement_voucher_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trails(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trails(created_at);

-- Indexes for Notifications
CREATE INDEX IF NOT EXISTS idx_notification_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notifications(created_at);

-- Composite indexes for common notification queries
CREATE INDEX IF NOT EXISTS idx_notification_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notification_user_created ON notifications(user_id, created_at);

-- Indexes for Attachments
CREATE INDEX IF NOT EXISTS idx_attachment_disbursement_id ON attachments(disbursement_voucher_id);
CREATE INDEX IF NOT EXISTS idx_attachment_uploaded_by ON attachments(uploaded_by_id);

-- Indexes for Disbursement Items
CREATE INDEX IF NOT EXISTS idx_disbursement_item_voucher_id ON disbursement_items(disbursement_voucher_id);

-- Performance Analysis Queries
-- Use these to identify slow queries and missing indexes

-- Check for missing indexes on foreign keys
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('disbursement_vouchers', 'users', 'approvals', 'audit_trails', 'notifications')
ORDER BY tablename, attname;

-- Check table sizes and index usage
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
