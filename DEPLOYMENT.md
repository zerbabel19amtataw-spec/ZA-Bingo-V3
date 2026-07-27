# ZA Bingo V3 — Deployment & Launch Checklist

## Pre-Launch Checklist

### Backend Setup
- [ ] Firebase Realtime Database created and initialized
- [ ] Cloud Functions deployed successfully
- [ ] Database rules deployed
- [ ] Telegram bot token set as Cloud Function secret
- [ ] Three game rooms created (5, 10, 20 Br)
- [ ] Admin account set up
- [ ] Cloud Function logs reviewed for errors

### Frontend Setup
- [ ] Firebase config updated in `public/firebase.js`
- [ ] Hosting deployed to Firebase Hosting
- [ ] Service Worker registered and working
- [ ] All screens tested on mobile device
- [ ] Responsive design verified on various screen sizes

### Telegram Bot Setup
- [ ] Telegram bot created via @BotFather
- [ ] Bot token saved securely
- [ ] Mini app registered with correct URL
- [ ] Deep link tested (`https://t.me/YOUR_BOT/app`)
- [ ] Bot replies to `/start` command

### Testing
- [ ] Authentication flow works (Telegram login)
- [ ] Profile creation and editing works
- [ ] Wallet balance displays correctly
- [ ] Deposit request submission works
- [ ] Withdrawal request submission works
- [ ] Can join a room
- [ ] Can select cartelas (max 2)
- [ ] Game countdown timer works
- [ ] Numbers are called correctly
- [ ] Can claim bingo
- [ ] Winner is determined correctly
- [ ] Prize is awarded
- [ ] Chat works in game
- [ ] Leaderboard updates in real-time
- [ ] Sound effects work
- [ ] Haptic feedback works
- [ ] Offline mode (Service Worker) caches app
- [ ] Settings (sound/notifications) persist

### Security Review
- [ ] Database rules reviewed (no accidental public writes)
- [ ] Cloud Functions validate all money operations
- [ ] Telegram initData signature verified on login
- [ ] No sensitive data in client-side code
- [ ] API keys are environment variables, not hardcoded
- [ ] HTTPS enforced (Firebase Hosting default)

### Compliance & Legal
- [ ] Terms & Conditions written and displayed
- [ ] Privacy Policy created and accessible
- [ ] Responsible Gaming warnings added
- [ ] Age verification (if required in your jurisdiction)
- [ ] Refund policy documented
- [ ] Data retention policy set
- [ ] KYC/AML requirements checked for your region
- [ ] Gaming license obtained (if required)

### Operations
- [ ] Error logging set up (e.g., Sentry, Firebase Crashlytics)
- [ ] Analytics enabled (Firebase Analytics or custom)
- [ ] Monitoring alerts configured (high error rate, function latency)
- [ ] Backup strategy for database
- [ ] Support email/contact setup
- [ ] Admin approval workflow tested (deposits/withdrawals)
- [ ] Player support queue created

## Launch Steps

### 1. Final Testing (Day before launch)
```bash
# Deploy everything one more time
firebase deploy

# Check logs
firebase functions:log --follow

# Test with multiple devices
# Test joining same room with 2+ players
# Test full game flow from start to finish
```

### 2. Go Live
```bash
# Ensure all data is backed up
# Set game rooms to "waiting" state
# Start with small player limits (e.g., 10 players per room)
# Monitor logs closely

# Monitor these Cloud Function metrics:
# - invocation count
# - execution time
# - error rate
# - memory usage
```

### 3. Monitor First Week
- [ ] Player registration rate healthy
- [ ] No unexpected errors in logs
- [ ] No duplicate winners or balance issues
- [ ] Chat moderation working (profanity filter)
- [ ] Wallet operations smooth
- [ ] Response times acceptable
- [ ] Players reaching out with issues

### 4. Gradual Scale-Up
- Increase room capacities from 10 → 20 → 30 players
- Monitor database read/write usage
- Monitor Cloud Function invocation costs
- Increase game callout frequency if needed
- Add additional game rooms if demand warrants

## Post-Launch Operations

### Daily
- [ ] Check error logs for new issues
- [ ] Monitor database usage (approaching limits?)
- [ ] Respond to support requests
- [ ] Verify deposits/withdrawals processed correctly

### Weekly
- [ ] Review player statistics
- [ ] Check for banned/suspicious accounts
- [ ] Review payment gateway reconciliation
- [ ] Feature request/feedback summary

### Monthly
- [ ] Generate revenue report
- [ ] Analyze retention metrics
- [ ] Plan features based on user feedback
- [ ] Review security logs
- [ ] Test disaster recovery procedures

## Scaling Considerations

### Database Performance
RTDB has free tier limits:
- 100 concurrent connections
- 1 GB storage
- 10 GB/month download

Upgrade to Blaze (pay-as-you-go) at these thresholds:
- Expecting > 100 concurrent users
- Daily revenue > $10-20
- Want growth without auto-scaling restrictions

### Cloud Functions
Monitor costs (pay per invocation + GB-seconds):
- `telegramAuth`: ~once per player session
- `joinRoom`: ~once per game per player
- `tickRoom`: Called every 1s per active game
- `claimBingo`: ~once per game
- `approveRequest`: Occasional (admin action)

Estimate: 1000 concurrent players across 30 games = ~30,000 invocations/minute during active hours.

### Optimization Tips
1. Batch database writes where possible
2. Set reasonable timeouts on functions (default 60s, tune to ~20s)
3. Use async/await to avoid blocking
4. Limit chat message history (keep only recent 100)
5. Archive old game history to Cloud Storage
6. Cache leaderboard in memory (expires every 10s)

## Disaster Recovery

### Backup Strategy
```bash
# Export database weekly (automated via Cloud Scheduler)
gsutil -m cp -R "gs://YOUR_PROJECT_ID.appspot.com/backup-$(date +%Y%m%d)/*" gs://YOUR_BUCKET/

# Keep backups for 90 days
```

### Database Rollback
If corrupted data:
1. Stop all Cloud Functions (disable them)
2. Identify the issue in logs
3. Manually fix affected player balances in database
4. Re-enable functions

### Account Recovery
If player loses access:
1. Verify ownership via Telegram ID
2. Manually adjust balance if incorrectly deducted
3. Send confirmation via Telegram bot

## Incidents & Troubleshooting

### "The game froze and I can't claim"
- Check if game reached 75 called numbers
- Check if player balance is still locked
- Manually finalize game if needed (admin function)
- Refund entry fee if game invalid

### "My deposit was approved but balance didn't update"
- Check `/deposits/{uid}` for status
- Check `/transactions/{uid}` for corresponding transaction
- If missing, manually create transaction and update balance

### "Two players claimed bingo at same time"
- Database transactions should prevent this
- Check logs to see who claimed first (timestamp)
- Only first claimant gets prize
- Refund second claimant's entry fee

### "Leaderboard shows wrong stats"
- `/leaderboard` is denormalized copy of `/players`
- It gets updated by Cloud Functions after each game
- If out of sync, trigger manual sync
- Stats should reconcile within a few minutes

## Regulatory Notes

### Different Jurisdictions
- **Ethiopia:** Check with National Lottery Authority
- **Kenya:** Betting Control & Licensing Board
- **Nigeria:** National Lottery Regulatory Commission
- **South Africa:** National Gambling Board
- **USA/EU:** State/country specific gambling regulations

### Required Disclosures
- House edge (15% commission)
- Odds of winning (depends on number of players)
- Responsible gaming resources
- How to report problem gambling

## Support Resources

### Create Support Documentation
- FAQ page (top 20 questions)
- Video tutorial on how to play
- Deposit/withdrawal troubleshooting guide
- Account recovery procedures
- Bonus/promotion terms

### Escalation Path
1. User reads FAQ/Help section
2. User contacts support via Telegram (@YOUR_SUPPORT_BOT)
3. Support ticket created in database
4. Admin responds within 24 hours
5. For money issues, escalate to financial team

## Success Metrics

Track these to measure platform health:

```
Daily Active Users (DAU)
Weekly Active Users (WAU)
Monthly Active Users (MAU)
Average Session Length
Total Revenue
Revenue Per User
Churn Rate
Support Ticket Volume
App Crash Rate
Function Error Rate
Average Game Duration
Games Completed Per Day
New Player Retention (Day 1, 7, 30)
```

## Congratulations! 🎉

You're now running a production multiplayer game. Monitor, iterate, and grow responsibly.
