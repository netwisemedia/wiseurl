const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ahwxzlhzbbzkvorjcyym.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function createGroupsTable() {
    console.log('Creating groups table and adding group_id to links...');

    // Test if we can access SQL - unfortunately Supabase JS client doesn't support raw SQL
    // User needs to run add_groups.sql in Supabase SQL Editor

    // Test if groups table exists by trying to query it
    const { error: groupsError } = await supabase
        .from('groups')
        .select('id')
        .limit(1);

    if (groupsError && groupsError.code === '42P01') {
        console.log('\n❌ Groups table does not exist yet.\n');
        console.log('Please run this SQL in Supabase SQL Editor:');
        console.log('(Go to: Supabase Dashboard → SQL Editor → New Query)\n');
        console.log('-------------------------------------------');
        console.log(`
-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT 'gray',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add group_id to links
ALTER TABLE links ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own groups" ON groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own groups" ON groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own groups" ON groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own groups" ON groups FOR DELETE USING (auth.uid() = user_id);
    `);
        console.log('-------------------------------------------\n');
    } else if (!groupsError) {
        console.log('✅ Groups table already exists!');

        // Check if links has group_id column
        const { data: links, error: linksError } = await supabase
            .from('links')
            .select('group_id')
            .limit(1);

        if (linksError && linksError.message.includes('group_id')) {
            console.log('⚠️  links.group_id column missing. Add it with:');
            console.log('ALTER TABLE links ADD COLUMN group_id UUID REFERENCES groups(id);');
        } else {
            console.log('✅ links.group_id column exists!');
        }
    } else {
        console.error('Unexpected error:', groupsError);
    }
}

createGroupsTable();
