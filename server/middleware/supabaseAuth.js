import { createRemoteJWKSet, jwtVerify } from 'jose';
import { findUserByAuthId, touchLastActive } from '../db/users.js';

// Lazily constructed — dotenv.config() in server.js runs after route modules are
// imported (and this module along with them), so SUPABASE_JWKS_URL isn't set yet
// at module-evaluation time. Build it on first actual use instead.
let jwks = null;
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL));
  }
  return jwks;
}

// Verifies the bearer token and returns the Supabase auth.uid() (the JWT's `sub`
// claim). Does not require a matching public.users row to already exist — used by
// /auth/init, whose job is to create that row on first contact.
export async function verifySupabaseToken(req) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    const err = new Error('No token provided');
    err.status = 401;
    throw err;
  }

  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: `${process.env.SUPABASE_URL}/auth/v1`
  });

  return payload.sub;
}

// Generic route guard: verifies the token AND requires an existing public.users row
// (created via /auth/init). Deliberately does not upsert on the fly, so a missing
// row surfaces as a 401 rather than being silently papered over.
const auth = async (req, res, next) => {
  try {
    const authUserId = await verifySupabaseToken(req);
    const user = await findUserByAuthId(authUserId);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    await touchLastActive(user.id);

    req.user = user;
    req.userId = user.id;
    req.authUserId = authUserId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

export default auth;
