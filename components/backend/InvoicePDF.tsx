'use client'
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { Student, Payment } from '@/types/app.types'

// Create styles
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        color: '#333',
        fontFamily: 'Helvetica',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 20,
    },
    companyInfo: {
        flexDirection: 'column',
    },
    companyName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2563eb',
        marginBottom: 5,
    },
    invoiceTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'right',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: '#f8fafc',
        padding: 5,
        marginBottom: 10,
        borderLeftWidth: 3,
        borderLeftColor: '#2563eb',
    },
    row: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    label: {
        width: 100,
        fontWeight: 'bold',
        color: '#64748b',
    },
    value: {
        flex: 1,
    },
    table: {
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        padding: 8,
        fontWeight: 'bold',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        padding: 8,
    },
    col1: { width: '20%' },
    col2: { width: '40%' },
    col3: { width: '20%', textAlign: 'right' },
    col4: { width: '20%', textAlign: 'right' },
    summary: {
        marginTop: 30,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    summaryBox: {
        width: 200,
        borderTopWidth: 2,
        borderTopColor: '#2563eb',
        paddingTop: 10,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2563eb',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        textAlign: 'center',
        color: '#94a3b8',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 20,
    }
})

interface InvoiceProps {
    student: Student
    payments: Payment[]
}

export const InvoicePDF = ({ student, payments }: InvoiceProps) => {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    const balance = (student.total_fee || 0) - totalPaid

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.companyInfo}>
                        <Text style={styles.companyName}>DISTANCE COURSES WALA</Text>
                        <Text>Education Consultant & Support</Text>
                        <Text>New Delhi, India</Text>
                        <Text>Email: info@distancecourseswala.com</Text>
                    </View>
                    <View>
                        <Text style={styles.invoiceTitle}>INVOICE</Text>
                        <Text style={{ textAlign: 'right', marginTop: 5 }}>Date: {format(new Date(), 'dd MMM yyyy')}</Text>
                        <Text style={{ textAlign: 'right' }}>Invoice #: INV-{Math.floor(Math.random() * 90000) + 10000}</Text>
                    </View>
                </View>

                {/* Student Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>STUDENT DETAILS</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Full Name:</Text>
                        <Text style={styles.value}>{student.full_name}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Enrollment #:</Text>
                        <Text style={styles.value}>{student.enrollment_number}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Course:</Text>
                        <Text style={styles.value}>{student.course?.name || 'N/A'}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Phone:</Text>
                        <Text style={styles.value}>{student.phone}</Text>
                    </View>
                </View>

                {/* Payment History */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PAYMENT HISTORY</Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.col1}>Date</Text>
                            <Text style={styles.col2}>Description</Text>
                            <Text style={styles.col3}>Mode</Text>
                            <Text style={styles.col4}>Amount</Text>
                        </View>
                        {payments.map((p, i) => (
                            <View key={i} style={styles.tableRow}>
                                <Text style={styles.col1}>{format(new Date(p.payment_date), 'dd MMM yy')}</Text>
                                <Text style={styles.col2}>{p.notes || 'Tuition Fee Payment'}</Text>
                                <Text style={styles.col3}>{p.payment_mode.toUpperCase()}</Text>
                                <Text style={styles.col4}>₹{p.amount.toLocaleString()}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Summary */}
                <View style={styles.summary}>
                    <View style={styles.summaryBox}>
                        <View style={styles.summaryRow}>
                            <Text style={{ color: '#64748b' }}>Total Fee:</Text>
                            <Text>₹{(student.total_fee || 0).toLocaleString()}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={{ color: '#64748b' }}>Total Paid:</Text>
                            <Text style={{ color: '#16a34a' }}>₹{totalPaid.toLocaleString()}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text>Balance:</Text>
                            <Text>₹{balance.toLocaleString()}</Text>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text>This is a computer-generated document. No signature is required.</Text>
                    <Text style={{ marginTop: 5 }}>Thank you for choosing Distance Courses Wala!</Text>
                </View>
            </Page>
        </Document>
    )
}
