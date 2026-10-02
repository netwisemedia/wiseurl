const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ahwxzlhzbbzkvorjcyym.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function fixDuplicates() {
    // Get all groups
    const { data: groups, error } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('Groups found:', groups.length);
    groups.forEach(g => console.log(`  - ${g.name} (${g.id})`));

    // Find duplicates (keep first, delete rest)
    const seen = new Map();
    const toDelete = [];

    for (const g of groups) {
        const key = g.name.toLowerCase();
        if (seen.has(key)) {
            toDelete.push(g.id);
            console.log(`Duplicate: ${g.name} (${g.id}) - will delete`);
        } else {
            seen.set(key, g.id);
        }
    }

    if (toDelete.length > 0) {
        console.log(`\nDeleting ${toDelete.length} duplicate(s)...`);
        const { error: delError } = await supabase
            .from('groups')
            .delete()
            .in('id', toDelete);

        if (delError) {
            console.error('Delete error:', delError.message);
        } else {
            console.log('✅ Duplicates deleted!');
        }
    } else {
        console.log('No duplicates found.');
    }
}

fixDuplicates();
