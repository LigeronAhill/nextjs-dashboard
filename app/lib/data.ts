import {neon} from '@neondatabase/serverless';
import {
    CustomerField,
    CustomersTableType,
    InvoiceForm,
    InvoicesTable,
    LatestInvoice,
    LatestInvoiceRaw,
    Revenue,
} from './definitions';
import {formatCurrency} from './utils';

const sql = neon(process.env.POSTGRES_URL!);

export async function fetchRevenue() {
    try {
        // Artificially delay a response for demo purposes.
        // Don't do this in production :)

        // console.log('Fetching revenue data...');
        // await new Promise((resolve) => setTimeout(resolve, 3000));

        const result = await sql`SELECT *
                                 FROM revenue`;
        // console.log('Data fetch completed after 3 seconds.');
        const data: Revenue[] = result.map((row) => ({
            month: row.month,
            revenue: row.revenue,
        }));

        return data;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch revenue data.');
    }
}

export async function fetchLatestInvoices() {
    try {
        const rows = await sql`
            SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
            FROM invoices
                     JOIN customers ON invoices.customer_id = customers.id
            ORDER BY invoices.date DESC LIMIT 5`;
        const data_raw: LatestInvoiceRaw[] = rows.map((invoice) => ({
            id: invoice.id,
            name: invoice.name,
            image_url: invoice.image_url,
            email: invoice.email,
            amount: invoice.amount,
        }));
        const data: LatestInvoice[] = data_raw.map((invoice) => ({
            id: invoice.id,
            name: invoice.name,
            image_url: invoice.image_url,
            email: invoice.email,
            amount: formatCurrency(invoice.amount),
        }))
        return data;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch the latest invoices.');
    }
}

export async function fetchCardData() {
    try {
        // You can probably combine these into a single SQL query
        // However, we are intentionally splitting them to demonstrate
        // how to initialize multiple queries in parallel with JS.
        const invoiceCountPromise = sql`SELECT COUNT(*)
                                        FROM invoices`;
        const customerCountPromise = sql`SELECT COUNT(*)
                                         FROM customers`;
        const invoiceStatusPromise = sql`SELECT SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)    AS "paid",
                                                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
                                         FROM invoices`;

        const data = await Promise.all([
            invoiceCountPromise,
            customerCountPromise,
            invoiceStatusPromise,
        ]);

        const numberOfInvoices = Number(data[0][0].count ?? '0');
        const numberOfCustomers = Number(data[1][0].count ?? '0');
        const totalPaidInvoices = formatCurrency(data[2][0].paid ?? '0');
        const totalPendingInvoices = formatCurrency(data[2][0].pending ?? '0');

        return {
            numberOfCustomers,
            numberOfInvoices,
            totalPaidInvoices,
            totalPendingInvoices,
        };
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch card data.');
    }
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(
    query: string,
    currentPage: number,
) {
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    try {
        const result = await sql`
            SELECT invoices.id,
                   invoices.amount,
                   invoices.date,
                   invoices.status,
                   customers.name,
                   customers.email,
                   customers.image_url
            FROM invoices
                     JOIN customers ON invoices.customer_id = customers.id
            WHERE customers.name ILIKE ${`%${query}%`}
               OR
                customers.email ILIKE ${`%${query}%`}
               OR
                invoices.amount::text ILIKE ${`%${query}%`}
               OR
                invoices.date::text ILIKE ${`%${query}%`}
               OR
                invoices.status ILIKE ${`%${query}%`}
            ORDER BY invoices.date DESC
                LIMIT ${ITEMS_PER_PAGE}
            OFFSET ${offset}
        `;
        const invoices: InvoicesTable[] = result.map((invoice) => ({
            id: invoice.id,
            customer_id: invoice.customer_id,
            name: invoice.name,
            email: invoice.email,
            image_url: invoice.image_url,
            date: invoice.date,
            amount: invoice.amount,
            status: invoice.status,
        }));

        return invoices;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch invoices.');
    }
}

export async function fetchInvoicesPages(query: string) {
    try {
        const data = await sql`SELECT COUNT(*)
                               FROM invoices
                                        JOIN customers ON invoices.customer_id = customers.id
                               WHERE customers.name ILIKE ${`%${query}%`}
                                  OR
                                   customers.email ILIKE ${`%${query}%`}
                                  OR
                                   invoices.amount::text ILIKE ${`%${query}%`}
                                  OR
                                   invoices.date::text ILIKE ${`%${query}%`}
                                  OR
                                   invoices.status ILIKE ${`%${query}%`}
        `;

        return Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch total number of invoices.');
    }
}

export async function fetchInvoiceById(id: string) {
    try {
        const data = await sql`
            SELECT invoices.id,
                   invoices.customer_id,
                   invoices.amount,
                   invoices.status
            FROM invoices
            WHERE invoices.id = ${id};
        `;

        const invoice: InvoiceForm[] = data.map((invoice) => ({
            id: invoice.id,
            customer_id: invoice.customer_id,
            amount: invoice.amount / 100,
            status: invoice.status,
        }));

        return invoice[0];
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch invoice.');
    }
}

export async function fetchCustomers() {
    try {
        const rows = await sql`
            SELECT id,
                   name
            FROM customers
            ORDER BY name ASC
        `;
        const customers: CustomerField[] = rows.map((customer) => ({
            id: customer.id,
            name: customer.name,
        }))

        return customers;
    } catch (err) {
        console.error('Database Error:', err);
        throw new Error('Failed to fetch all customers.');
    }
}

export async function fetchFilteredCustomers(query: string) {
    try {
        const rows = await sql`
            SELECT customers.id,
                   customers.name,
                   customers.email,
                   customers.image_url,
                   COUNT(invoices.id)                                                         AS total_invoices,
                   SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
                   SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END)    AS total_paid
            FROM customers
                     LEFT JOIN invoices ON customers.id = invoices.customer_id
            WHERE customers.name ILIKE ${`%${query}%`}
               OR
                customers.email ILIKE ${`%${query}%`}
            GROUP BY customers.id, customers.name, customers.email, customers.image_url
            ORDER BY customers.name ASC
        `;

        const data: CustomersTableType[] = rows.map((customer) => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            image_url: customer.image_url,
            total_invoices: customer.total_invoices,
            total_pending: customer.total_pending,
            total_paid: customer.total_paid,
        }));

        return data.map((customer) => ({
            ...customer,
            total_pending: formatCurrency(customer.total_pending),
            total_paid: formatCurrency(customer.total_paid),
        }));
    } catch (err) {
        console.error('Database Error:', err);
        throw new Error('Failed to fetch customer table.');
    }
}
