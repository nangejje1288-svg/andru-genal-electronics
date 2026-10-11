(function () {
    const url = window.SUPABASE_URL;
    const anonKey = window.SUPABASE_ANON_KEY;
    const clientFactory = window.supabase && window.supabase.createClient;

    if (!url || !anonKey || !clientFactory) {
        const configurationError = !clientFactory
            ? new Error('The Supabase client library could not load. Check the network connection and try again.')
            : new Error('Supabase is not configured. Add the project URL and anon key to supabase-config.js.');
        const notConfigured = async function () {
            throw configurationError;
        };
        window.storeData = {
            configured: false,
            configurationError,
            getProducts: notConfigured,
            getNews: notConfigured,
            getComments: notConfigured,
            addComment: notConfigured,
            signIn: notConfigured,
            signOut: notConfigured,
            requireAdmin: notConfigured
        };
        return;
    }

    const client = clientFactory(url, anonKey);

    async function requireAdmin() {
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) throw new Error('Sign in with an administrator account to continue.');

        const { data, error } = await client
            .from('admin_users')
            .select('user_id')
            .eq('user_id', userData.user.id)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('This account does not have administrator access.');
        return userData.user;
    }

    function fromDatabaseProduct(row, costPrice) {
        return {
            id: row.id,
            name: row.name,
            category: row.category,
            costPrice: costPrice ?? null,
            sellingPrice: row.selling_price == null ? null : Number(row.selling_price),
            stock: Number(row.stock),
            image: row.image,
            description: row.description || ''
        };
    }

    async function getProducts() {
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        let admin = false;
        if (userData.user) {
            const { data, error } = await client
                .from('admin_users')
                .select('user_id')
                .eq('user_id', userData.user.id)
                .maybeSingle();
            if (error) throw error;
            admin = Boolean(data);
        }

        const { data: rows, error } = await client
            .from('products')
            .select('id,name,category,selling_price,stock,image,description')
            .order('created_at', { ascending: true });
        if (error) throw error;

        let costs = {};
        if (admin) {
            const { data: costRows, error: costError } = await client
                .from('product_costs')
                .select('product_id,cost_price');
            if (costError) throw costError;
            costs = Object.fromEntries(costRows.map(row => [row.product_id, Number(row.cost_price)]));
        }
        return rows.map(row => fromDatabaseProduct(row, costs[row.id]));
    }

    async function saveProduct(product) {
        await requireAdmin();
        const row = {
            id: String(product.id),
            name: product.name,
            category: product.category,
            selling_price: product.sellingPrice == null ? null : Number(product.sellingPrice),
            stock: Number(product.stock),
            image: product.image,
            description: product.description || ''
        };
        const { error } = await client.from('products').upsert(row);
        if (error) throw error;

        if (product.costPrice == null || product.costPrice === '') {
            const { error: costError } = await client.from('product_costs').delete().eq('product_id', row.id);
            if (costError) throw costError;
        } else {
            const { error: costError } = await client.from('product_costs').upsert({
                product_id: row.id,
                cost_price: Number(product.costPrice)
            });
            if (costError) throw costError;
        }
    }

    async function deleteProduct(id) {
        await requireAdmin();
        const { error } = await client.from('products').delete().eq('id', String(id));
        if (error) throw error;
    }

    async function getNews() {
        const { data, error } = await client
            .from('discount_news')
            .select('id,title,message,date,created_at')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async function saveNews(item) {
        await requireAdmin();
        const { error } = await client.from('discount_news').insert({
            id: String(item.id),
            title: item.title,
            message: item.message,
            date: item.date || null
        });
        if (error) throw error;
    }

    async function deleteNews(id) {
        await requireAdmin();
        const { error } = await client.from('discount_news').delete().eq('id', String(id));
        if (error) throw error;
    }

    async function getComments() {
        const { data, error } = await client
            .from('service_comments')
            .select('id,name,message,created_at')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    }

    async function addComment(name, message) {
        const { error } = await client.from('service_comments').insert({
            name: name || 'Customer',
            message
        });
        if (error) throw error;
    }

    async function importBrowserData(payload) {
        await requireAdmin();
        const products = Array.isArray(payload.products) ? payload.products : [];
        const news = Array.isArray(payload.news) ? payload.news : [];
        const comments = Array.isArray(payload.comments) ? payload.comments : [];

        if (products.length) {
            const rows = products.map(product => ({
                id: String(product.id),
                name: String(product.name),
                category: String(product.category || 'Other Electronics'),
                selling_price: product.sellingPrice ?? product.price ?? null,
                stock: Number(product.stock) || 0,
                image: String(product.image),
                description: String(product.description || '')
            }));
            const { error } = await client.from('products').upsert(rows);
            if (error) throw error;

            const costRows = products
                .filter(product => product.costPrice != null && product.costPrice !== '')
                .map(product => ({ product_id: String(product.id), cost_price: Number(product.costPrice) }));
            if (costRows.length) {
                const { error: costError } = await client.from('product_costs').upsert(costRows);
                if (costError) throw costError;
            }
        }

        if (news.length) {
            const rows = news.map(item => ({
                id: String(item.id),
                title: String(item.title),
                message: String(item.message),
                date: item.date || null
            }));
            const { error } = await client.from('discount_news').upsert(rows);
            if (error) throw error;
        }

        if (comments.length) {
            const rows = comments.map(comment => ({
                name: String(comment.name || 'Customer').slice(0, 80),
                message: String(comment.message).slice(0, 1000),
                created_at: comment.createdAt || new Date().toISOString()
            }));
            const { error } = await client.from('service_comments').insert(rows);
            if (error) throw error;
        }

        return { products: products.length, news: news.length, comments: comments.length };
    }

    window.storeData = {
        configured: true,
        client,
        requireAdmin,
        signIn: (email, password) => client.auth.signInWithPassword({ email, password }),
        signOut: () => client.auth.signOut(),
        getProducts,
        saveProduct,
        deleteProduct,
        getNews,
        saveNews,
        deleteNews,
        getComments,
        addComment,
        importBrowserData
    };
})();
