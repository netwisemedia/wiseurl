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

async function runMigration() {
    console.log('Running groups migration...');

    // Check if groups table exists
    const { data: tables, error: tablesError } = await supabase
        .from('groups')
        .select('id')
        .limit(1);

    if (tablesError && tablesError.code === '42P01') {
        console.log('Groups table does not exist. You need to run add_groups.sql in Supabase SQL Editor.');
        console.log('The SQL migration cannot be run via the JS client - it requires direct SQL access.');
        return;
    }

    console.log('Groups table status:', tablesError ? 'needs creation' : 'exists');

    // Check existing links
    const { data: links, error: linksError } = await supabase
        .from('links')
        .select('id, code')
        .order('created_at', { ascending: false })
        .limit(5);

    if (linksError) {
        console.error('Error fetching links:', linksError.message);
    } else {
        console.log('Recent links:', links?.map(l => l.code).join(', ') || 'none');
    }

    // Check for ceapa link
    const { data: ceapa, error: ceapaError } = await supabase
        .from('links')
        .select('*')
        .eq('code', 'ceapa')
        .single();

    if (ceapaError) {
        console.log('Link "ceapa" not found:', ceapaError.message);
    } else {
        console.log('Link "ceapa" exists:', ceapa);
    }
}

runMigration();
