//If it talks about security → Auth domain
// If it talks about storage → Users module

import * as bcrypt from 'bcrypt';

export class UserDomain {
  static hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  static comparePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }
}
