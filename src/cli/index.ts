#!/usr/bin/env node

import cli from '@gql.tada/cli-utils';

('default' in cli ? (cli.default as typeof cli) : cli)();
