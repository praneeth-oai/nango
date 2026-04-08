import * as z from 'zod';

import { getLogger, requireEmptyQuery, zodErrorToHTTP } from '@nangohq/utils';

import { finalizeManagedAuthentication, getManagedAuthRequestMetadata, saveSession } from './utils.js';
import { getWorkOSClient } from '../../../../clients/workos.client.js';
import { envs } from '../../../../env.js';
import { asyncWrapper } from '../../../../utils/asyncWrapper.js';

import type { PostManagedEmailVerification } from '@nangohq/types';

const logger = getLogger('Server.AuthManagedVerification');

const validation = z
    .object({
        code: z.string().trim().min(6).max(12)
    })
    .strict();

export const postManagedEmailVerification = asyncWrapper<PostManagedEmailVerification>(async (req, res) => {
    const emptyQuery = requireEmptyQuery(req);
    if (emptyQuery) {
        res.status(400).send({ error: { code: 'invalid_query_params', errors: zodErrorToHTTP(emptyQuery.error) } });
        return;
    }

    const val = validation.safeParse(req.body);
    if (!val.success) {
        res.status(400).send({
            error: { code: 'invalid_body', errors: zodErrorToHTTP(val.error) }
        });
        return;
    }

    const verification = req.session.managedAuthEmailVerification;
    if (!verification) {
        res.status(404).send({
            error: { code: 'not_found', message: 'No pending WorkOS email verification was found. Please try signing in with Google again.' }
        });
        return;
    }

    const workos = getWorkOSClient();

    try {
        const authResponse = await workos.userManagement.authenticateWithEmailVerification({
            clientId: envs.WORKOS_CLIENT_ID || '',
            code: val.data.code,
            pendingAuthenticationToken: verification.pendingAuthenticationToken,
            ...getManagedAuthRequestMetadata(req)
        });

        await finalizeManagedAuthentication({
            req,
            res,
            authorizedUser: authResponse.user,
            organizationId: authResponse.organizationId,
            workos,
            state: verification.state,
            responseMode: 'json'
        });
    } catch (err) {
        const workosErr = err as {
            rawData?: {
                code?: string;
                message?: string;
                pending_authentication_token?: string;
                email?: string;
                email_verification_id?: string;
            };
        };

        if (
            workosErr.rawData?.code === 'email_verification_required' &&
            workosErr.rawData.pending_authentication_token &&
            workosErr.rawData.email &&
            workosErr.rawData.email_verification_id
        ) {
            req.session.managedAuthEmailVerification = {
                email: workosErr.rawData.email,
                pendingAuthenticationToken: workosErr.rawData.pending_authentication_token,
                emailVerificationId: workosErr.rawData.email_verification_id,
                state: verification.state
            };
            await saveSession(req);
        }

        logger.warn('Failed to authenticate WorkOS email verification code', {
            code: workosErr.rawData?.code,
            message: workosErr.rawData?.message
        });
        res.status(400).send({
            error: {
                code: 'invalid_verification_code',
                message: workosErr.rawData?.message || 'The verification code is invalid or has expired. Please try signing in with Google again.'
            }
        });
    }
});
