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

    // Create slider_banners table
    await this.query(`
      CREATE TABLE IF NOT EXISTS slider_banners (
        id SERIAL PRIMARY KEY,
        shop VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        status BOOLEAN DEFAULT true,

        -- Format
        desktop_aspect_ratio VARCHAR(20),
        mobile_aspect_ratio VARCHAR(20),

        -- Slider Settings
        add_border BOOLEAN DEFAULT false,
        transition_effect VARCHAR(100),
        delay_between_slides INTEGER DEFAULT 5,

        -- Slides (JSON array)
        slides JSONB NOT NULL DEFAULT '[]',

        -- Scheduling
        scheduling_enabled BOOLEAN DEFAULT false,
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,

        -- Assignment
        assignment JSONB NOT NULL DEFAULT '{}',

        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for slider_banners
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_slider_banners_shop ON slider_banners(shop)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_slider_banners_status ON slider_banners(status)
    `);

    // Create advertisements table
    await this.query(`
      CREATE TABLE IF NOT EXISTS advertisements (
        id SERIAL PRIMARY KEY,
        shop VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        status BOOLEAN DEFAULT true,

        -- Size: 1x1, 2x1, 3x1, 4x1
        size VARCHAR(10) NOT NULL DEFAULT '1x1',

        -- Desktop image (Shopify CDN)
        desktop_image JSONB,

        -- Mobile image (Shopify CDN)
        mobile_image JSONB,

        -- Button settings
        button_enabled BOOLEAN DEFAULT false,
        button_text VARCHAR(255),
        button_link_type VARCHAR(50),
        button_link_value VARCHAR(500),
        button_bg_color VARCHAR(7) DEFAULT '#2e7d32',
        button_text_color VARCHAR(7) DEFAULT '#ffffff',
        button_text_size VARCHAR(10) DEFAULT '16px',
        button_placement VARCHAR(20) DEFAULT 'center',

        -- Scheduling
        scheduling_enabled BOOLEAN DEFAULT false,
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,

        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for advertisements
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_advertisements_shop ON advertisements(shop)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_advertisements_status ON advertisements(status)
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

  // ==================== SLIDER BANNER OPERATIONS ====================

  async createSliderBanner(shop, data) {
    const result = await this.query(
      `INSERT INTO slider_banners (
        shop, name, status,
        desktop_aspect_ratio, mobile_aspect_ratio,
        add_border, transition_effect, delay_between_slides,
        slides, scheduling_enabled, start_date, end_date,
        assignment, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`,
      [
        shop,
        data.name,
        data.status ?? true,
        data.desktopAspectRatio || null,
        data.mobileAspectRatio || null,
        data.addBorder ?? false,
        data.transitionEffect || null,
        data.delayBetweenSlides ?? 5,
        JSON.stringify(data.slides || []),
        data.schedulingEnabled ?? false,
        data.startDate || null,
        data.endDate || null,
        JSON.stringify(data.assignment || {}),
        data.priority ?? 0
      ]
    );
    return this.parseSliderBanner(result.rows[0]);
  }

  async getAllSliderBanners(shop) {
    const result = await this.query(
      `SELECT * FROM slider_banners
       WHERE shop = ?
       ORDER BY priority DESC, created_at DESC`,
      [shop]
    );
    return result.rows.map(row => this.parseSliderBanner(row));
  }

  async getSliderBannerById(id) {
    const result = await this.query(
      "SELECT * FROM slider_banners WHERE id = ?",
      [id]
    );
    if (!result.rows[0]) return null;
    return this.parseSliderBanner(result.rows[0]);
  }

  async getActiveSliderBanners(shop) {
    const result = await this.query(
      `SELECT * FROM slider_banners
       WHERE shop = ? AND status = true
       ORDER BY priority DESC`,
      [shop]
    );
    return result.rows.map(row => this.parseSliderBanner(row));
  }

  async updateSliderBanner(id, data) {
    const result = await this.query(
      `UPDATE slider_banners SET
        name = ?,
        status = ?,
        desktop_aspect_ratio = ?,
        mobile_aspect_ratio = ?,
        add_border = ?,
        transition_effect = ?,
        delay_between_slides = ?,
        slides = ?,
        scheduling_enabled = ?,
        start_date = ?,
        end_date = ?,
        assignment = ?,
        priority = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *`,
      [
        data.name,
        data.status ?? true,
        data.desktopAspectRatio || null,
        data.mobileAspectRatio || null,
        data.addBorder ?? false,
        data.transitionEffect || null,
        data.delayBetweenSlides ?? 5,
        JSON.stringify(data.slides || []),
        data.schedulingEnabled ?? false,
        data.startDate || null,
        data.endDate || null,
        JSON.stringify(data.assignment || {}),
        data.priority ?? 0,
        id
      ]
    );
    return this.parseSliderBanner(result.rows[0]);
  }

  async deleteSliderBanner(id) {
    await this.query("DELETE FROM slider_banners WHERE id = ?", [id]);
  }

  async duplicateSliderBanner(id, shop) {
    const original = await this.getSliderBannerById(id);
    if (!original) return null;

    const newData = {
      ...original,
      name: original.name ? `${original.name} (Copy)` : 'Copy',
    };
    delete newData.id;
    delete newData.createdAt;
    delete newData.updatedAt;

    return await this.createSliderBanner(shop, newData);
  }

  // Helper to parse slider banner JSON fields
  parseSliderBanner(row) {
    if (!row) return null;
    return {
      id: row.id,
      shop: row.shop,
      name: row.name,
      status: row.status,
      desktopAspectRatio: row.desktop_aspect_ratio,
      mobileAspectRatio: row.mobile_aspect_ratio,
      addBorder: row.add_border,
      transitionEffect: row.transition_effect,
      delayBetweenSlides: row.delay_between_slides,
      slides: typeof row.slides === 'string' ? JSON.parse(row.slides) : row.slides,
      schedulingEnabled: row.scheduling_enabled,
      startDate: row.start_date,
      endDate: row.end_date,
      assignment: typeof row.assignment === 'string' ? JSON.parse(row.assignment) : row.assignment,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ==================== ADVERTISEMENT OPERATIONS ====================

  async createAdvertisement(shop, data) {
    const result = await this.query(
      `INSERT INTO advertisements (
        shop, name, status, size,
        desktop_image, mobile_image,
        button_enabled, button_text, button_link_type, button_link_value,
        button_bg_color, button_text_color, button_text_size, button_placement,
        scheduling_enabled, start_date, end_date, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`,
      [
        shop,
        data.name,
        data.status ?? true,
        data.size || '1x1',
        JSON.stringify(data.desktopImage || null),
        JSON.stringify(data.mobileImage || null),
        data.buttonEnabled ?? false,
        data.buttonText || null,
        data.buttonLinkType || null,
        data.buttonLinkValue || null,
        data.buttonBgColor || '#2e7d32',
        data.buttonTextColor || '#ffffff',
        data.buttonTextSize || '16px',
        data.buttonPlacement || 'center',
        data.schedulingEnabled ?? false,
        data.startDate || null,
        data.endDate || null,
        data.priority ?? 0
      ]
    );
    return this.parseAdvertisement(result.rows[0]);
  }

  async getAllAdvertisements(shop) {
    const result = await this.query(
      `SELECT * FROM advertisements
       WHERE shop = ?
       ORDER BY priority DESC, created_at DESC`,
      [shop]
    );
    return result.rows.map(row => this.parseAdvertisement(row));
  }

  async getAdvertisementById(id) {
    const result = await this.query(
      "SELECT * FROM advertisements WHERE id = ?",
      [id]
    );
    if (!result.rows[0]) return null;
    return this.parseAdvertisement(result.rows[0]);
  }

  async getActiveAdvertisements(shop) {
    const result = await this.query(
      `SELECT * FROM advertisements
       WHERE shop = ? AND status = true
       ORDER BY priority DESC`,
      [shop]
    );
    return result.rows.map(row => this.parseAdvertisement(row));
  }

  async updateAdvertisement(id, data) {
    const result = await this.query(
      `UPDATE advertisements SET
        name = ?,
        status = ?,
        size = ?,
        desktop_image = ?,
        mobile_image = ?,
        button_enabled = ?,
        button_text = ?,
        button_link_type = ?,
        button_link_value = ?,
        button_bg_color = ?,
        button_text_color = ?,
        button_text_size = ?,
        button_placement = ?,
        scheduling_enabled = ?,
        start_date = ?,
        end_date = ?,
        priority = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *`,
      [
        data.name,
        data.status ?? true,
        data.size || '1x1',
        JSON.stringify(data.desktopImage || null),
        JSON.stringify(data.mobileImage || null),
        data.buttonEnabled ?? false,
        data.buttonText || null,
        data.buttonLinkType || null,
        data.buttonLinkValue || null,
        data.buttonBgColor || '#2e7d32',
        data.buttonTextColor || '#ffffff',
        data.buttonTextSize || '16px',
        data.buttonPlacement || 'center',
        data.schedulingEnabled ?? false,
        data.startDate || null,
        data.endDate || null,
        data.priority ?? 0,
        id
      ]
    );
    return this.parseAdvertisement(result.rows[0]);
  }

  async deleteAdvertisement(id) {
    await this.query("DELETE FROM advertisements WHERE id = ?", [id]);
  }

  async duplicateAdvertisement(id, shop) {
    const original = await this.getAdvertisementById(id);
    if (!original) return null;

    const newData = {
      ...original,
      name: original.name ? `${original.name} (Copy)` : 'Copy',
    };
    delete newData.id;
    delete newData.createdAt;
    delete newData.updatedAt;

    return await this.createAdvertisement(shop, newData);
  }

  // Helper to parse advertisement JSON fields
  parseAdvertisement(row) {
    if (!row) return null;
    return {
      id: row.id,
      shop: row.shop,
      name: row.name,
      status: row.status,
      size: row.size,
      desktopImage: typeof row.desktop_image === 'string' ? JSON.parse(row.desktop_image) : row.desktop_image,
      mobileImage: typeof row.mobile_image === 'string' ? JSON.parse(row.mobile_image) : row.mobile_image,
      buttonEnabled: row.button_enabled,
      buttonText: row.button_text,
      buttonLinkType: row.button_link_type,
      buttonLinkValue: row.button_link_value,
      buttonBgColor: row.button_bg_color,
      buttonTextColor: row.button_text_color,
      buttonTextSize: row.button_text_size,
      buttonPlacement: row.button_placement,
      schedulingEnabled: row.scheduling_enabled,
      startDate: row.start_date,
      endDate: row.end_date,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // GDPR compliance - delete all shop data
  async deleteShopData(shop) {
    console.log(`[Database] Deleting all data for shop: ${shop}`);
    const announcementResult = await this.query(
      "DELETE FROM announcement_bars WHERE shop = ?",
      [shop]
    );
    const sliderResult = await this.query(
      "DELETE FROM slider_banners WHERE shop = ?",
      [shop]
    );
    const advertisementResult = await this.query(
      "DELETE FROM advertisements WHERE shop = ?",
      [shop]
    );
    console.log(`[Database] Deleted ${announcementResult.rowCount || 0} announcement bars for shop: ${shop}`);
    console.log(`[Database] Deleted ${sliderResult.rowCount || 0} slider banners for shop: ${shop}`);
    console.log(`[Database] Deleted ${advertisementResult.rowCount || 0} advertisements for shop: ${shop}`);
    return (announcementResult.rowCount || 0) + (sliderResult.rowCount || 0) + (advertisementResult.rowCount || 0);
  }

  close() {
    this.db.close();
  }
}

const database = new Database();

export default database;
