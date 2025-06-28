import { SmartLLMRouter } from '../../llm/index.js';
import { SupabaseClient } from '../../database/index.js';
export class FinanceAgent {
    constructor(userId) {
        this.userId = userId;
        this.llmRouter = new SmartLLMRouter();
    }
    async processTask(task) {
        console.log(`💰 Finance Agent processing ${task.type} task...`);
        // Save conversation state
        const conversation = await SupabaseClient.saveConversation({
            user_id: this.userId,
            agent_type: 'finance',
            state: { task, status: 'processing' },
            messages: []
        });
        try {
            let result;
            switch (task.type) {
                case 'categorize_expense':
                    result = await this.categorizeExpense(task);
                    break;
                case 'generate_report':
                    result = await this.generateReport(task);
                    break;
                case 'analyze_transaction':
                    result = await this.analyzeTransaction(task);
                    break;
                case 'budget_forecast':
                    result = await this.budgetForecast(task);
                    break;
                case 'invoice_generate':
                    result = await this.generateInvoice(task);
                    break;
                default:
                    throw new Error(`Unknown finance task type: ${task.type}`);
            }
            // Update conversation with result
            await SupabaseClient.saveConversation({
                ...conversation,
                state: { task, status: 'completed', result },
                messages: [...(conversation.messages || []), { type: 'result', content: result }]
            });
            return result;
        }
        catch (error) {
            console.error('❌ Finance Agent error:', error);
            await SupabaseClient.saveConversation({
                ...conversation,
                state: { task, status: 'failed', error: error.message }
            });
            throw error;
        }
    }
    async categorizeExpense(task) {
        const prompt = `
Categorize this business expense:
- Amount: $${task.amount}
- Description: ${task.description}
- Date: ${task.date}

Choose from these business expense categories:
- Office Supplies
- Software/SaaS
- Marketing/Advertising
- Travel/Transportation
- Meals/Entertainment
- Equipment/Hardware
- Utilities
- Professional Services
- Training/Education
- Insurance
- Rent/Facilities
- Other

Respond with JSON containing:
- category: the category name
- subcategory: more specific classification
- taxDeductible: boolean
- notes: any relevant notes for accounting
- confidence: your confidence level (high/medium/low)
`;
        const messages = [
            { role: 'system', content: 'You are a professional accounting assistant specializing in business expense categorization.' },
            { role: 'user', content: prompt }
        ];
        const response = await this.llmRouter.route(messages, 'medium');
        return this.parseFinanceResponse(response);
    }
    async generateReport(task) {
        const prompt = `
Generate a ${task.reportType} financial report for the ${task.period} period.

Transaction data: ${JSON.stringify(task.transactions, null, 2)}

Please provide:
1. Executive Summary (2-3 sentences)
2. Key Financial Metrics
3. Notable Trends or Patterns
4. Recommendations for improvement
5. Action Items

Format as a structured business report.
`;
        const messages = [
            { role: 'system', content: 'You are a financial analyst creating professional business reports.' },
            { role: 'user', content: prompt }
        ];
        const response = await this.llmRouter.route(messages, 'complex');
        return {
            reportType: task.reportType,
            period: task.period,
            generatedAt: new Date().toISOString(),
            content: response.message?.content || 'Error generating report',
            summary: this.extractSummary(response.message?.content || '')
        };
    }
    async analyzeTransaction(task) {
        const prompt = `
Analyze this business transaction for potential issues or insights:

Amount: $${task.amount}
Description: ${task.description}
Date: ${task.date}

Look for:
- Unusual patterns
- Potential tax implications
- Recurring expense opportunities
- Cost optimization suggestions
- Compliance considerations

Provide a brief analysis with actionable insights.
`;
        const messages = [
            { role: 'system', content: 'You are a financial analyst specializing in transaction analysis and business optimization.' },
            { role: 'user', content: prompt }
        ];
        const response = await this.llmRouter.route(messages, 'medium');
        return {
            transaction: {
                amount: task.amount,
                description: task.description,
                date: task.date
            },
            analysis: response.message?.content || 'Error analyzing transaction',
            riskLevel: this.assessRiskLevel(response.message?.content || ''),
            recommendations: this.extractRecommendations(response.message?.content || '')
        };
    }
    async budgetForecast(task) {
        const prompt = `
Create a budget forecast based on this historical data:

Transactions: ${JSON.stringify(task.transactions, null, 2)}
Period: ${task.period}

Provide:
1. Revenue projections
2. Expense forecasts by category
3. Cash flow predictions
4. Growth assumptions
5. Risk factors to consider

Format as a professional budget forecast with numbers and percentages.
`;
        const messages = [
            { role: 'system', content: 'You are a financial planning expert creating budget forecasts for businesses.' },
            { role: 'user', content: prompt }
        ];
        const response = await this.llmRouter.route(messages, 'complex');
        return {
            forecastPeriod: task.period,
            generatedAt: new Date().toISOString(),
            forecast: response.message?.content || 'Error generating forecast',
            confidence: 'medium', // TODO: Add confidence scoring
            keyAssumptions: this.extractAssumptions(response.message?.content || '')
        };
    }
    async generateInvoice(task) {
        const { invoiceData } = task;
        if (!invoiceData)
            throw new Error('Invoice data required');
        const total = invoiceData.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const prompt = `
Generate a professional invoice with this information:

Client: ${invoiceData.clientName}
Items: ${JSON.stringify(invoiceData.items, null, 2)}
Due Date: ${invoiceData.dueDate}
Total: $${total}

Create professional invoice text including:
- Invoice header
- Client details section
- Itemized services/products
- Payment terms
- Professional closing

Format as ready-to-send invoice content.
`;
        const messages = [
            { role: 'system', content: 'You are a professional invoice generator creating formal business invoices.' },
            { role: 'user', content: prompt }
        ];
        const response = await this.llmRouter.route(messages, 'medium');
        return {
            invoiceNumber: `INV-${Date.now()}`,
            clientName: invoiceData.clientName,
            items: invoiceData.items,
            subtotal: total,
            tax: total * 0.08, // 8% tax rate - make configurable
            total: total * 1.08,
            dueDate: invoiceData.dueDate,
            content: response.message?.content || 'Error generating invoice',
            status: 'draft'
        };
    }
    // Helper methods
    parseFinanceResponse(response) {
        try {
            const content = response.message?.content || '';
            if (content.includes('{') && content.includes('}')) {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            }
            return { content, parsed: false };
        }
        catch (error) {
            return { content: response.message?.content || '', parsed: false, error: error.message };
        }
    }
    extractSummary(content) {
        const lines = content.split('\n');
        const summaryLine = lines.find(line => line.toLowerCase().includes('summary') ||
            line.toLowerCase().includes('executive'));
        return summaryLine || lines.slice(0, 2).join(' ');
    }
    assessRiskLevel(content) {
        const riskWords = ['unusual', 'high', 'concerning', 'risk', 'alert'];
        const riskCount = riskWords.filter(word => content.toLowerCase().includes(word)).length;
        if (riskCount >= 3)
            return 'high';
        if (riskCount >= 1)
            return 'medium';
        return 'low';
    }
    extractRecommendations(content) {
        const lines = content.split('\n');
        return lines
            .filter(line => line.includes('recommend') ||
            line.includes('suggest') ||
            line.includes('consider'))
            .map(line => line.trim())
            .slice(0, 3); // Top 3 recommendations
    }
    extractAssumptions(content) {
        const lines = content.split('\n');
        return lines
            .filter(line => line.includes('assume') ||
            line.includes('based on') ||
            line.includes('projection'))
            .map(line => line.trim())
            .slice(0, 3); // Top 3 assumptions
    }
}
