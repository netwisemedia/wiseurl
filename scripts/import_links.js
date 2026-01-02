const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ahwxzlhzbbzkvorjcyym.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const userId = 'a27327b4-60a8-4bc0-bdbf-a42713fcc796';

const links = [
    { code: 'google', destination_url: 'https://www.google.com', title: 'Google' },
    { code: 'yahoo', destination_url: 'http://www.yahoo.com', title: 'yahoo' },
    { code: 'wired', destination_url: 'https://www.wired.com/', title: 'wired' },
    { code: '4goodhosting', destination_url: 'https://4goodhosting.com/billing2/aff.php?aff=273', title: '4goodhosting' },
    { code: '101domain', destination_url: 'https://www.101domain.com/affiliate/nna.html', title: '101domain' },
    { code: '123systems', destination_url: 'https://123systems.net/billing/aff.php?aff=1322', title: '123systems' },
    { code: 'accuwebhosting', destination_url: 'https://www.accuwebhosting.com/ref/560.html', title: 'accuwebhosting' },
    { code: 'ipvanish', destination_url: 'https://affiliate.ipvanish.com/aff_c?offer_id=1&aff_id=1876', title: 'ipvanish' },
    { code: 'purevpn', destination_url: 'https://billing.purevpn.com/aff.php?aff=5184', title: 'purevpn' },
    { code: 'altushost', destination_url: 'https://cp.altushost.com/?affid=466', title: 'altushost' },
    { code: 'aseohosting', destination_url: 'https://billing.aseohosting.com/aff.php?aff=332', title: 'aseohosting' },
    { code: 'aspirationhosting', destination_url: 'https://my.aspirationhosting.com/aff.php?aff=331', title: 'aspirationhosting' },
    { code: 'backupsy', destination_url: 'https://backupsy.com/aff.php?aff=203', title: 'backupsy' },
    { code: 'banahosting', destination_url: 'https://manage.banahosting.com/aff.php?aff=59', title: 'banahosting' },
    { code: 'beyondhosting', destination_url: 'https://clients.beyondhosting.net/aff.php?aff=1069', title: 'beyondhosting' },
    { code: 'bigboxhost', destination_url: 'https://secure.bigboxhost.com/aff.php?aff=4', title: 'bigboxhost' },
    { code: 'bigscoots', destination_url: 'https://www.bigscoots.com/portal/?affid=87', title: 'bigscoots' },
    { code: 'bluehost', destination_url: 'https://www.bluehost.com/track/ropages/', title: 'bluehost' },
    { code: 'budgetvm', destination_url: 'https://www.budgetvm.com?affid=747', title: 'budgetvm' },
    { code: 'cinfu', destination_url: 'https://panel.cinfu.com/aff.php?aff=323', title: 'cinfu' },
    { code: 'constant', destination_url: 'http://www.constant.com/?ref=6802419', title: 'constant' },
    { code: 'dediseedbox', destination_url: 'https://dediseedbox.com/clients/aff.php?aff=784', title: 'dediseedbox' },
    { code: 'digitalocean', destination_url: 'https://m.do.co/c/2f857bca1840', title: 'digitalocean' },
    { code: 'expressvpn', destination_url: 'https://www.linkev.com/?a_aid=wise', title: 'expressvpn' },
    { code: 'fastestvpn', destination_url: 'https://go.fastestvpn.com/affiliate/pap?a_aid=5af2ce9e41eb6', title: 'fastestvpn' },
    { code: 'fastwebhost', destination_url: 'https://www.fastwebhost.com/773.html', title: 'fastwebhost' },
    { code: 'flipperhost', destination_url: 'https://www.flipperhost.com/billing/aff.php?aff=59', title: 'flipperhost' },
    { code: 'hawkhost', destination_url: 'https://my.hawkhost.com/aff.php?aff=3830', title: 'hawkhost' },
    { code: 'hidemyass', destination_url: 'https://click.hmavpn.com/aff_c?offer_id=1&aff_id=428', title: 'hidemyass' },
    { code: 'hostforweb', destination_url: 'http://www.hostforweb.com/2500.html', title: 'hostforweb' },
    { code: 'hosthatch', destination_url: 'https://hosthatch.com/a?id=89', title: 'hosthatch' },
    { code: 'hosthongkong', destination_url: 'https://www.hosthongkong.net/billing/aff.php?aff=41', title: 'hosthongkong' },
    { code: 'hostmantis', destination_url: 'https://my.hostmantis.com/aff.php?aff=288', title: 'hostmantis' },
    { code: 'hostsailor', destination_url: 'https://clients.hostsailor.com/aff.php?aff=135', title: 'hostsailor' },
    { code: 'hostupon', destination_url: 'https://hostupon.com/idevaffiliate/idevaffiliate.php?id=351', title: 'hostupon' },
    { code: 'hostwithlove', destination_url: 'https://clients.hostwithlove.com/aff.php?aff=1', title: 'hostwithlove' },
    { code: 'ifastnet', destination_url: 'https://ifastnet.com/portal/aff.php?aff=21537', title: 'ifastnet' },
    { code: 'iniz', destination_url: 'https://my.iniz.com/aff.php?aff=28', title: 'iniz' },
    { code: 'innohosting', destination_url: 'https://client.innohosting.com/aff.php?aff=429', title: 'innohosting' },
    { code: 'knownsrv', destination_url: 'https://knownsrv.com/clients/aff.php?aff=201', title: 'knownsrv' },
    { code: 'koddos', destination_url: 'https://koddos.net/clients/aff.php?aff=203', title: 'koddos' },
    { code: 'kvchosting', destination_url: 'http://www.kvchosting.net/943.html', title: 'kvchosting' },
    { code: 'leapswitch', destination_url: 'https://service.leapswitch.com/aff.php?aff=183', title: 'leapswitch' },
    { code: 'limenex', destination_url: 'https://clients.limenex.com/aff.php?aff=35', title: 'limenex' },
    { code: 'milesweb', destination_url: 'http://affiliates.milesweb.com/105.html', title: 'milesweb' },
    { code: 'monstermegs', destination_url: 'https://affiliates.monstermegs.com/idevaffiliate.php?id=234', title: 'monstermegs' },
    { code: 'namesilo', destination_url: 'https://www.namesilo.com/?rid=974b922gf', title: 'namesilo' },
    { code: 'nextpointhost', destination_url: 'https://nextpointhost.com/?aff=124', title: 'nextpointhost' },
    { code: 'nordvpn', destination_url: 'https://go.nordvpn.net/aff_c?offer_id=380&aff_id=750', title: 'nordvpn' },
    { code: 'photonvps', destination_url: 'https://www.photonvps.com/billing/aff.php?aff=3046', title: 'photonvps' },
    { code: 'protonvpn', destination_url: 'https://go.getproton.me/SHi2', title: 'protonvpn' },
    { code: 'time4vps', destination_url: 'https://tracking.missaffiliate.com/aff_c?offer_id=138&aff_id=5450', title: 'time4vps' },
    { code: 'qhoster', destination_url: 'https://www.qhoster.com/clients/aff.php?aff=49', title: 'qhoster' },
    { code: 'webhostingpad', destination_url: 'https://www.webhostingpad.com/10760.html', title: 'WebhostingPad' }
];

async function migrate() {
    console.log(`Preparing to migrate ${links.length} links for user ${userId}...`);

    let successCount = 0;
    let errorCount = 0;

    for (const link of links) {
        const { error } = await supabase
            .from('links')
            .upsert({
                code: link.code,
                destination_url: link.destination_url,
                title: link.title || link.code,
                user_id: userId,
                is_active: true
            }, { onConflict: 'code' });

        if (error) {
            console.error(`❌ Failed to import ${link.code}:`, error.message);
            errorCount++;
        } else {
            console.log(`✅ Imported: ${link.code}`);
            successCount++;
        }
    }

    console.log('\nMigration complete!');
    console.log(`Total Success: ${successCount}`);
    console.log(`Total Errors: ${errorCount}`);
}

migrate();
