"use strict";

/** User of the site. */

const { NotFoundError } = require("../expressError");
const db = require("../db");
const bcrypt = require("bcrypt");
const { BCRYPT_WORK_FACTOR } = require("../config");


class User {

  /** Register new user. Returns
   *    {username, password, first_name, last_name, phone}
   */

  static async register({ username, password, first_name, last_name, phone }) {

    const hashedPassword = await bcrypt.hash(
      password,
      BCRYPT_WORK_FACTOR
    );

    const result = await db.query(
      `INSERT INTO users (username,
                          password,
                          first_name,
                          last_name,
                          phone,
                          join_at,
                          last_login_at)
        VALUES
          ($1, $2, $3, $4, $5, current_timestamp, current_timestamp)
        RETURNING username, password, first_name, last_name, phone`,
      [username, hashedPassword, first_name, last_name, phone]);

    return result.rows[0];
  }

  /** Authenticate: is username/password valid? Returns boolean. */

  static async authenticate(username, password) {

    const result = await db.query(
      `SELECT password
         FROM users
         WHERE username = $1 `,
      [username]);

    const user = result.rows[0];

    return user && await bcrypt.compare(password, user.password) === true;

    // if (user) {
    //   if (await bcrypt.compare(password, user.password) === true) {
    //     return true;
    //   } else {
    //     return false;
    //   }
    // }
  }

  /** Update last_login_at for user */

  static async updateLoginTimestamp(username) {

    const result = await db.query(
      `UPDATE users
        SET last_login_at = current_timestamp
          WHERE username = $1
          RETURNING username, last_login_at`,
      [username]);
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`User${username} not found`);

    return user;

  }

  /** All: basic info on all users:
   * [{username, first_name, last_name}, ...] */

  static async all() {
    const result = await db.query(
      `SELECT username, first_name, last_name
      FROM users
      ORDER BY username`);

    const users = result.rows;
    return users;
  }

  /** Get: get user by username
   *
   * returns {username,
   *          first_name,
   *          last_name,
   *          phone,
   *          join_at,
   *          last_login_at } */

  static async get(username) {
    const result = await db.query(
      `SELECT username, first_name, last_name, phone, join_at, last_login_at
      FROM users
      WHERE username = $1`,
      [username]);
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`User${username} not found`);

    return user;
  }

  /** Return messages from this user.
   *
   * [{id, to_user, body, sent_at, read_at}]
   *
   * where to_user is
   *   {username, first_name, last_name, phone}
   */

  static async messagesFrom(username) {

    const result = await db.query(
      `SELECT m.id,
              m.to_username,
              m.body,
              m.sent_at,
              m.read_at,
              t.first_name AS first_name,
              t.last_name AS last_name,
              t.phone AS phone
      FROM messages m
        JOIN users t ON m.to_username = t.username
      WHERE m.from_username = $1`,
      [username]);

    let messages = result.rows;

    //unneeded because should be job of another function to check validity
    // if (!message) throw new NotFoundError(`No such message: ${message.id}`);


    return messages.map(message => ({
      id: message.id,
      to_user: {
        username: message.to_username,
        first_name: message.first_name,
        last_name: message.last_name,
        phone: message.phone
      },
      body: message.body,
      sent_at: message.sent_at,
      read_at: message.read_at
    })
    );
  }


  /** Return messages to this user.
   *
   * [{id, from_user, body, sent_at, read_at}]
   *
   * where from_user is
   *   {username, first_name, last_name, phone}
   */

  static async messagesTo(username) {

    const result = await db.query(
      `SELECT m.id,
              m.from_username,
              m.body,
              m.sent_at,
              m.read_at,
              f.first_name AS first_name,
              f.last_name AS last_name,
              f.phone AS phone
      FROM messages m
        JOIN users f ON m.from_username = f.username
      WHERE m.to_username = $1`,
      [username]);

    let messages = result.rows;

    return messages.map(message => (
      {
        id: message.id,
        from_user: {
          username: message.from_username,
          first_name: message.first_name,
          last_name: message.last_name,
          phone: message.phone
        },
        body: message.body,
        sent_at: message.sent_at,
        read_at: message.read_at
      })
    );
  }
}


module.exports = User;
