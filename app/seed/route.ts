import bcrypt from 'bcrypt';
import {Pool, PoolClient} from '@neondatabase/serverless';
import {customers, invoices, revenue, users} from '../lib/placeholder-data';


async function seedUsers(client: PoolClient) {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS users
        (
            id       UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            name     VARCHAR(255) NOT NULL,
            email    TEXT         NOT NULL UNIQUE,
            password TEXT         NOT NULL
        );
    `);

    return await Promise.all(
        users.map(async (user) => {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            return client.query(`
                INSERT INTO users (id, name, email, password)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id)
                    DO NOTHING;`, [user.id, user.name, user.email, hashedPassword]);
        }),
    );
}

async function seedInvoices(client: PoolClient) {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await client.query(`
        CREATE TABLE IF NOT EXISTS invoices
        (
            id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            customer_id UUID         NOT NULL,
            amount      INT          NOT NULL,
            status      VARCHAR(255) NOT NULL,
            date        DATE         NOT NULL
        );
    `);

    return await Promise.all(
        invoices.map(
            (invoice) => client.query(`
                INSERT INTO invoices (customer_id, amount, status, date)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO NOTHING;`, [invoice.customer_id, invoice.amount, invoice.status, invoice.date]),
        ),
    );
}

async function seedCustomers(client: PoolClient) {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await client.query(`
        CREATE TABLE IF NOT EXISTS customers
        (
            id        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            name      VARCHAR(255) NOT NULL,
            email     VARCHAR(255) NOT NULL,
            image_url VARCHAR(255) NOT NULL
        );
    `);

    return await Promise.all(
        customers.map(
            (customer) => client.query(`
                INSERT INTO customers (id, name, email, image_url)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO NOTHING;`, [customer.id, customer.name, customer.email, customer.image_url]),
        ),
    );
}

async function seedRevenue(client: PoolClient) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS revenue
        (
            month   VARCHAR(4) NOT NULL UNIQUE,
            revenue INT        NOT NULL
        );
    `);

    return await Promise.all(
        revenue.map(
            (rev) => client.query(`
                INSERT INTO revenue (month, revenue)
                VALUES ($1, $2)
                ON CONFLICT (month) DO NOTHING;`, [rev.month, rev.revenue]),
        ),
    );
}

export async function GET() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set');
    }
    const pool = new Pool({connectionString: process.env.DATABASE_URL});
    const client = await pool.connect();
    try {
        await client.query("BEGIN;");
        await seedUsers(client);
        await seedCustomers(client);
        await seedInvoices(client);
        await seedRevenue(client);
        await client.query('COMMIT;');
        await pool.end();
        return Response.json({message: 'Database seeded successfully'});
    } catch (error) {
        await client.query('ROLLBACK');
        await pool.end();
        return Response.json({error}, {status: 500});
    } finally {
        client.release();
        await pool.end();
    }
}
