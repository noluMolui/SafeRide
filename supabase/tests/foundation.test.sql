-- SafeRide Phase 1 foundation tests
begin;

select plan(10);

select has_extension('pgcrypto', 'pgcrypto is enabled');
select has_type('public', 'user_role', 'user_role enum exists');
select has_type('public', 'verification_status', 'verification_status enum exists');
select has_type('public', 'route_direction', 'route_direction enum exists');
select has_type('public', 'enrollment_status', 'enrollment_status enum exists');
select has_type('public', 'trip_status', 'trip_status enum exists');
select has_type('public', 'log_status', 'log_status enum exists');
select has_type('public', 'delay_reason', 'delay_reason enum exists');
select has_type('public', 'fee_status', 'fee_status enum exists');
select has_type('public', 'payment_method', 'payment_method enum exists');

select * from finish();
rollback;
