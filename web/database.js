import pg from "pg";

const { Pool } = pg;

// PostgreSQL Database Class
class PostgreSQLDatabase {
  constructor(connectionString) {
    if (!connectionString) {
      throw new Error(
        "[Database] DATABASE_URL environment variable is required. " +
        "Please set it to your PostgreSQL connection string."
      );
    }

    const isProduction = process.env.NODE_ENV === "production";
    const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

    const poolConfig = {
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    if (isProduction && !isLocalhost) {
      poolConfig.ssl = {
        rejectUnauthorized: false,
      };
    }

    console.log("[Database] Initializing with SSL:", !!poolConfig.ssl);
    this.pool = new Pool(poolConfig);
  }

  async initialize() {
    // Create announcement_bars table
    await this.query(`
      CREATE TABLE IF NOT EXISTS announcement_bars (
        id SERIAL PRIMARY KEY,
        shop VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        status BOOLEAN DEFAULT true,
        background_color VARCHAR(7) DEFAULT '#000000',

        -- Content (JSON array of lines)
        content JSONB NOT NULL DEFAULT '[]',

        -- Scheduling
        scheduling_enabled BOOLEAN DEFAULT false,
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,

        -- Link/CTA
        link_enabled BOOLEAN DEFAULT false,
        link_type VARCHAR(50),
        link_value VARCHAR(500),
        link_target VARCHAR(20) DEFAULT '_self',

        -- Coupon
        coupon_enabled BOOLEAN DEFAULT false,
        coupon_code VARCHAR(100),
        coupon_display JSONB,

        -- Assignment
        assignment JSONB NOT NULL DEFAULT '{}',

        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_announcement_bars_shop ON announcement_bars(shop)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_announcement_bars_status ON announcement_bars(status)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_announcement_bars_priority ON announcement_bars(priority DESC)
    `);

    console.log("[Database] PostgreSQL initialized successfully");
  }

  async query(sql, params = []) {
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const result = await this.pool.query(pgSql, params);
    return result;
  }

  async close() {
    await this.pool.end();
  }
}

// Database Wrapper with Application Logic
class Database {
  constructor() {
    console.log("[Database] Using PostgreSQL");
    this.db = new PostgreSQLDatabase(process.env.DATABASE_URL);
  }

  async initialize() {
    return await this.db.initialize();
  }

  async query(sql, params = []) {
    return await this.db.query(sql, params);
  }

  // Announcement Bar operations
  async createAnnouncementBar(shop, data) {
    const result = await this.query(
      `INSERT INTO announcement_bars (
        shop, name, status, background_color, content,
        scheduling_enabled, start_date, end_date,
        link_enabled, link_type, link_value, link_target,
        coupon_enabled, coupon_code, coupon_display,
        assignment, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`,
      [
        shop,
        data.name,
        data.status ?? true,
        data.backgroundColor || '#000000',
        JSON.stringify(data.content || []),
        data.schedulingEnabled ?? false,
        data.startDate || null,
        data.endDate || null,
        data.linkEnabled ?? false,
        data.linkType || null,
        data.linkValue || null,
        data.linkTarget || '_self',
        data.couponEnabled ?? false,
        data.couponCode || null,
        JSON.stringify(data.couponDisplay || null),
        JSON.stringify(data.assignment || {}),
        data.priority ?? 0
      ]
    );
    return this.parseAnnouncementBar(result.rows[0]);
  }

  async getAllAnnouncementBars(shop) {
    const result = await this.query(
      `SELECT * FROM announcement_bars
       WHERE shop = ?
       ORDER BY priority DESC, created_at DESC`,
      [shop]
    );
    return result.rows.map(row => this.parseAnnouncementBar(row));
  }

  async getAnnouncementBarById(id) {
    const result = await this.query(
      "SELECT * FROM announcement_bars WHERE id = ?",
      [id]
    );
    if (!result.rows[0]) return null;
    return this.parseAnnouncementBar(result.rows[0]);
  }

  async getActiveAnnouncementBars(shop) {
    const result = await this.query(
      `SELECT * FROM announcement_bars
       WHERE shop = ? AND status = true
       ORDER BY priority DESC`,
      [shop]
    );
    return result.rows.map(row => this.parseAnnouncementBar(row));
  }

  async updateAnnouncementBar(id, data) {
    const result = await this.query(
      `UPDATE announcement_bars SET
        name = ?,
        status = ?,
        background_color = ?,
        content = ?,
        scheduling_enabled = ?,
        start_date = ?,
        end_date = ?,
        link_enabled = ?,
        link_type = ?,
        link_value = ?,
        link_target = ?,
        coupon_enabled = ?,
        coupon_code = ?,
        coupon_display = ?,
        assignment = ?,
        priority = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *`,
      [
        data.name,
        data.status ?? true,
        data.backgroundColor || '#000000',
        JSON.stringify(data.content || []),
        data.schedulingEnabled ?? false,
        data.startDate || null,
        data.endDate || null,
        data.linkEnabled ?? false,
        data.linkType || null,
        data.linkValue || null,
        data.linkTarget || '_self',
        data.couponEnabled ?? false,
        data.couponCode || null,
        JSON.stringify(data.couponDisplay || null),
        JSON.stringify(data.assignment || {}),
        data.priority ?? 0,
        id
      ]
    );
    return this.parseAnnouncementBar(result.rows[0]);
  }

  async deleteAnnouncementBar(id) {
    await this.query("DELETE FROM announcement_bars WHERE id = ?", [id]);
  }

  async duplicateAnnouncementBar(id, shop) {
    const original = await this.getAnnouncementBarById(id);
    if (!original) return null;

    const newData = {
      ...original,
      name: original.name ? `${original.name} (Copy)` : 'Copy',
    };
    delete newData.id;
    delete newData.createdAt;
    delete newData.updatedAt;

    return await this.createAnnouncementBar(shop, newData);
  }

  async updateAnnouncementBarPriority(id, priority) {
    await this.query(
      "UPDATE announcement_bars SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [priority, id]
    );
  }

  async updateAllPriorities(priorities) {
    for (const { id, priority } of priorities) {
      await this.updateAnnouncementBarPriority(id, priority);
    }
  }

  // Helper to parse JSON fields
  parseAnnouncementBar(row) {
    if (!row) return null;
    return {
      id: row.id,
      shop: row.shop,
      name: row.name,
      status: row.status,
      backgroundColor: row.background_color,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      schedulingEnabled: row.scheduling_enabled,
      startDate: row.start_date,
      endDate: row.end_date,
      linkEnabled: row.link_enabled,
      linkType: row.link_type,
      linkValue: row.link_value,
      linkTarget: row.link_target,
      couponEnabled: row.coupon_enabled,
      couponCode: row.coupon_code,
      couponDisplay: typeof row.coupon_display === 'string' ? JSON.parse(row.coupon_display) : row.coupon_display,
      assignment: typeof row.assignment === 'string' ? JSON.parse(row.assignment) : row.assignment,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // GDPR compliance - delete all shop data
  async deleteShopData(shop) {
    console.log(`[Database] Deleting all data for shop: ${shop}`);
    const result = await this.query(
      "DELETE FROM announcement_bars WHERE shop = ?",
      [shop]
    );
    console.log(`[Database] Deleted ${result.rowCount || 0} announcement bars for shop: ${shop}`);
    return result.rowCount || 0;
  }

  close() {
    this.db.close();
  }
}

const database = new Database();

export default database;
