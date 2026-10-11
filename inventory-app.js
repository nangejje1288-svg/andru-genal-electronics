(function () {
    const data = window.storeData;
    const loginForm = document.getElementById('login-form');
    const errorBox = document.getElementById('login-error');
    const status = document.getElementById('admin-status');
    const loginScreen = document.getElementById('login-screen');
    const inventoryPage = document.getElementById('inventory-page');
    const tableBody = document.getElementById('inventory-table-body');
    let products = [];
    let news = [];

    function showError(error) {
        console.error(error);
        status.textContent = error.message || 'The request could not be completed.';
        status.classList.add('show');
    }

    function setBusy(isBusy) {
        document.querySelectorAll('#inventory-page button, #login-form button').forEach(button => {
            button.disabled = isBusy;
        });
    }

    function showLogin() {
        loginScreen.style.display = 'flex';
        inventoryPage.classList.add('hidden');
    }

    function showInventory() {
        loginScreen.style.display = 'none';
        inventoryPage.classList.remove('hidden');
    }

    function getStatus(stock) {
        if (stock <= 0) return { label: 'Out of Stock', className: 'out-stock' };
        if (stock <= 5) return { label: 'Low Stock', className: 'low-stock' };
        return { label: 'In Stock', className: 'in-stock' };
    }

    function makeInput(type, value, label, className) {
        const input = document.createElement('input');
        input.type = type;
        input.value = value == null ? '' : value;
        input.className = className || 'editable-name';
        input.setAttribute('aria-label', label);
        if (type === 'number') {
            input.min = '0';
            input.step = '1';
        }
        return input;
    }

    function renderInventory() {
        tableBody.replaceChildren();
        if (!products.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 8;
            cell.className = 'empty-state';
            cell.textContent = 'No products available.';
            row.append(cell);
            tableBody.append(row);
            return;
        }

        products.forEach(product => {
            const row = document.createElement('tr');
            row.dataset.id = product.id;
            const imageCell = document.createElement('td');
            const thumb = document.createElement('div');
            thumb.className = 'product-thumb';
            const image = document.createElement('img');
            image.src = product.image;
            image.alt = product.name;
            thumb.append(image);
            imageCell.append(thumb);

            const name = document.createElement('td');
            name.className = 'product-name';
            name.textContent = product.name;
            const category = document.createElement('td');
            category.className = 'product-category';
            category.textContent = product.category;
            const cost = document.createElement('td');
            cost.textContent = product.costPrice == null ? 'Not recorded' : `UGX ${Number(product.costPrice).toLocaleString()}`;
            const sale = document.createElement('td');
            sale.textContent = product.sellingPrice == null ? 'Not set' : `UGX ${Number(product.sellingPrice).toLocaleString()}`;
            const stock = document.createElement('td');
            stock.textContent = String(Number(product.stock) || 0);
            const statusCell = document.createElement('td');
            const badgeData = getStatus(Number(product.stock) || 0);
            const badge = document.createElement('span');
            badge.className = `status-badge ${badgeData.className}`;
            badge.textContent = badgeData.label;
            statusCell.append(badge);
            const actionCell = document.createElement('td');
            const actions = document.createElement('div');
            actions.className = 'table-actions';
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'action-btn edit-btn';
            edit.textContent = 'Edit Product Name & Prices';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'action-btn delete-product-btn';
            remove.textContent = 'Delete Product';
            actions.append(edit, remove);
            actionCell.append(actions);
            row.append(imageCell, name, category, cost, sale, stock, statusCell, actionCell);
            tableBody.append(row);
        });
    }

    function renderNews() {
        const list = document.getElementById('admin-news-list');
        list.replaceChildren();
        news.forEach(item => {
            const card = document.createElement('div');
            card.className = 'news-item';
            const copy = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = item.title;
            const message = document.createElement('p');
            message.textContent = item.message;
            copy.append(title, message);
            if (item.date) {
                const date = document.createElement('p');
                date.textContent = `Discount date: ${item.date}`;
                copy.append(date);
            }
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'delete-btn';
            remove.textContent = 'Delete';
            remove.addEventListener('click', async () => {
                setBusy(true);
                try {
                    await data.deleteNews(item.id);
                    await loadData();
                } catch (error) {
                    showError(error);
                } finally {
                    setBusy(false);
                }
            });
            card.append(copy, remove);
            list.append(card);
        });
    }

    async function loadData() {
        [products, news] = await Promise.all([data.getProducts(), data.getNews()]);
        renderInventory();
        renderNews();
    }

    function showConfigurationError() {
        errorBox.textContent = data.configurationError.message;
        errorBox.classList.add('show');
        document.querySelector('#login-form button').disabled = true;
    }

    if (!data.configured) {
        showLogin();
        showConfigurationError();
        return;
    }

    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        errorBox.classList.remove('show');
        status.classList.remove('show');
        setBusy(true);
        try {
            const email = document.getElementById('admin-email').value.trim();
            const password = document.getElementById('admin-password').value;
            const { error } = await data.signIn(email, password);
            if (error) throw error;
            await data.requireAdmin();
            showInventory();
            loginForm.reset();
            await loadData();
        } catch (error) {
            errorBox.textContent = error.message || 'Sign-in failed. Check the email and password.';
            errorBox.classList.add('show');
            await data.signOut();
        } finally {
            setBusy(false);
        }
    });

    document.getElementById('logout-button').addEventListener('click', async () => {
        setBusy(true);
        try {
            const { error } = await data.signOut();
            if (error) throw error;
            showLogin();
        } catch (error) {
            showError(error);
        } finally {
            setBusy(false);
        }
    });

    tableBody.addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button) return;
        const row = button.closest('tr');
        const product = products.find(item => String(item.id) === row.dataset.id);
        if (!product) return;

        if (button.classList.contains('edit-btn')) {
            row.replaceChildren();
            const values = [
                { value: product.image, label: 'Product image', type: 'image' },
                { value: product.name, label: 'Product name', type: 'text' },
                { value: product.category, label: 'Category', type: 'category' },
                { value: product.costPrice, label: 'Buying cost in UGX', type: 'number', className: 'editable-cost' },
                { value: product.sellingPrice, label: 'Selling price in UGX', type: 'number', className: 'editable-sale-price' },
                { value: product.stock, label: 'Stock', type: 'number', className: 'editable-stock' }
            ];
            values.forEach((item, index) => {
                const cell = document.createElement('td');
                if (item.type === 'image') {
                    const thumb = document.createElement('div');
                    thumb.className = 'product-thumb';
                    const img = document.createElement('img');
                    img.src = item.value;
                    img.alt = product.name;
                    thumb.append(img);
                    cell.append(thumb);
                } else if (item.type === 'category') {
                    const select = document.createElement('select');
                    select.className = 'editable-name editable-category';
                    select.setAttribute('aria-label', item.label);
                    ['Phones', 'Laptops', 'Accessories', 'TV & Entertainment', 'Other Electronics'].forEach(value => {
                        select.add(new Option(value, value));
                    });
                    select.value = item.value;
                    cell.append(select);
                } else {
                    const input = makeInput(item.type, item.value, item.label, item.className || 'editable-name');
                    cell.append(input);
                }
                row.append(cell);
            });
            const statusCell = document.createElement('td');
            statusCell.textContent = getStatus(Number(product.stock)).label;
            const actionCell = document.createElement('td');
            const save = document.createElement('button');
            save.type = 'button';
            save.className = 'save-btn';
            save.textContent = 'Save';
            actionCell.append(save);
            row.append(statusCell, actionCell);
            return;
        }

        if (button.classList.contains('save-btn')) {
            const update = {
                ...product,
                name: row.querySelector('input[aria-label="Product name"]').value.trim(),
                category: row.querySelector('.editable-category').value,
                costPrice: row.querySelector('.editable-cost').value,
                sellingPrice: row.querySelector('.editable-sale-price').value,
                stock: Number(row.querySelector('.editable-stock').value)
            };
            if (!update.name || !Number.isInteger(update.stock) || update.stock < 0 ||
                (update.costPrice !== '' && (!Number.isFinite(Number(update.costPrice)) || Number(update.costPrice) < 0)) ||
                (update.sellingPrice !== '' && (!Number.isFinite(Number(update.sellingPrice)) || Number(update.sellingPrice) < 0))) {
                showError(new Error('Enter a name, whole non-negative stock, and valid non-negative prices.'));
                return;
            }
            update.costPrice = update.costPrice === '' ? null : Number(update.costPrice);
            update.sellingPrice = update.sellingPrice === '' ? null : Number(update.sellingPrice);
            setBusy(true);
            try {
                await data.saveProduct(update);
                await loadData();
                status.textContent = 'Product saved.';
                status.classList.add('show');
            } catch (error) {
                showError(error);
            } finally {
                setBusy(false);
            }
            return;
        }

        if (button.classList.contains('delete-product-btn') &&
            confirm(`Delete "${product.name}" from inventory and customer pages?`)) {
            setBusy(true);
            try {
                await data.deleteProduct(product.id);
                await loadData();
            } catch (error) {
                showError(error);
            } finally {
                setBusy(false);
            }
        }
    });

    document.getElementById('news-form').addEventListener('submit', async event => {
        event.preventDefault();
        const title = document.getElementById('news-title').value.trim();
        const message = document.getElementById('news-message').value.trim();
        const date = document.getElementById('news-date').value;
        if (!title || !message) {
            showError(new Error('Enter a headline and discount details before posting.'));
            return;
        }
        setBusy(true);
        try {
            await data.saveNews({ id: crypto.randomUUID(), title, message, date });
            event.target.reset();
            await loadData();
        } catch (error) {
            showError(error);
        } finally {
            setBusy(false);
        }
    });

    document.getElementById('inventory-form').addEventListener('submit', async event => {
        event.preventDefault();
        const product = {
            id: crypto.randomUUID(),
            name: document.getElementById('product-name').value.trim(),
            category: document.getElementById('product-category').value,
            costPrice: Number(document.getElementById('product-cost').value),
            sellingPrice: Number(document.getElementById('product-sale-price').value),
            stock: Number(document.getElementById('product-stock').value),
            image: document.getElementById('product-image').value,
            description: ''
        };
        if (!product.name || !product.category || !product.image ||
            !Number.isFinite(product.costPrice) || product.costPrice < 0 ||
            !Number.isFinite(product.sellingPrice) || product.sellingPrice < 0 ||
            !Number.isInteger(product.stock) || product.stock < 0) {
            showError(new Error('Please fill in all product details with valid non-negative values.'));
            return;
        }
        setBusy(true);
        try {
            await data.saveProduct(product);
            event.target.reset();
            await loadData();
        } catch (error) {
            showError(error);
        } finally {
            setBusy(false);
        }
    });

    document.getElementById('import-browser-data').addEventListener('click', async () => {
        const products = JSON.parse(localStorage.getItem('andruInventory') || '[]');
        const news = JSON.parse(localStorage.getItem('andruDiscountNews') || '[]');
        const comments = JSON.parse(localStorage.getItem('andruServiceComments') || '[]');
        if (!products.length && !news.length && !comments.length) {
            showError(new Error('No saved browser inventory, news, or comments were found to import.'));
            return;
        }
        const summary = `${products.length} products, ${news.length} announcements, and ${comments.length} comments`;
        if (!confirm(`Import ${summary} into the shared database? Existing matching product IDs will be updated.`)) return;

        setBusy(true);
        try {
            const result = await data.importBrowserData({ products, news, comments });
            status.textContent = `Imported ${result.products} products, ${result.news} announcements, and ${result.comments} comments.`;
            status.classList.add('show');
            await loadData();
        } catch (error) {
            showError(error);
        } finally {
            setBusy(false);
        }
    });

    document.getElementById('product-image').replaceChildren(new Option('Select image', ''));
    for (let number = 173; number <= 179; number += 1) addImageOption(number);
    for (let number = 181; number <= 217; number += 1) addImageOption(number);
    [219, 221, 226, 228].forEach(addImageOption);
    for (let number = 231; number <= 298; number += 1) addImageOption(number);
    addImageOption(300);

    function addImageOption(number) {
        const select = document.getElementById('product-image');
        const index = select.options.length;
        const filename = `images/IMG-20260829-WA${String(number).padStart(4, '0')}.jpg`;
        select.add(new Option(`Product photo ${index}`, filename));
    }

    (async function initialize() {
        try {
            const { data: sessionData, error } = await data.client.auth.getSession();
            if (error) throw error;
            if (!sessionData.session) {
                showLogin();
                return;
            }
            await data.requireAdmin();
            showInventory();
            await loadData();
        } catch (error) {
            await data.signOut();
            showLogin();
            errorBox.textContent = error.message || 'Administrator authentication is required.';
            errorBox.classList.add('show');
        }
    })();
})();
